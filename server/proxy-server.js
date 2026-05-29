/**
 * Marine Navigator provider proxy.
 *
 * Provides a same-origin Node HTTP proxy for EMODnet/GEBCO requests, provider
 * health checks, response-size protection, CORS allowlisting, and short-lived
 * memory/disk caching for external provider responses.
 */

import http from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const PORT = Number(process.env.PORT || 8787);
const CACHE_TTL_MS = 1000 * 60 * 60;
const MAX_URL_LENGTH = 4096;
const memoryCache = new Map();
const DISK_CACHE_DIR = path.resolve(".proxy-cache");
const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];
const ALLOWED_ORIGINS = (
  process.env.PROXY_ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(",")
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const PROVIDER_TIMEOUT_MS = Number(process.env.PROXY_PROVIDER_TIMEOUT_MS || 3000);
const PROXY_TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT_MS || 10000);
const PROXY_MAX_RESPONSE_BYTES = Number(
  process.env.PROXY_MAX_RESPONSE_BYTES || 15 * 1024 * 1024,
);

const SOURCES = {
  emodnetWms: "https://ows.emodnet-bathymetry.eu/wms",
  gebcoWms: "https://wms.gebco.net/mapserv",
  emodnetDepth: "https://rest.emodnet-bathymetry.eu/depth_sample",
  osmTile: "https://a.tile.openstreetmap.org/0/0/0.png",
};

/**
 * Resolves the CORS origin allowed for a request.
 *
 * @param {http.IncomingMessage} request Node HTTP request.
 * @returns {string|null} Allowed origin value or null when blocked.
 */
function getCorsOrigin(request) {
  const requestOrigin = request?.headers.origin;
  if (ALLOWED_ORIGINS.includes("*")) return "*";
  if (!requestOrigin) return ALLOWED_ORIGINS[0] || null;
  if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) return requestOrigin;
  return null;
}

/**
 * Builds common security and CORS response headers.
 *
 * @param {http.IncomingMessage} request Node HTTP request.
 * @returns {Record<string, string>} Headers for proxy responses.
 */
function baseHeaders(request) {
  const origin = getCorsOrigin(request);
  return {
    ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
}

/**
 * Writes an HTTP response with shared proxy headers.
 *
 * @param {http.ServerResponse} response Node HTTP response.
 * @param {number} status HTTP status code.
 * @param {string|Buffer} body Response body.
 * @param {Record<string, string>} [headers={}] Additional headers.
 * @param {http.IncomingMessage|null} [request=null] Source request for CORS.
 * @returns {void}
 */
function send(response, status, body, headers = {}, request = null) {
  response.writeHead(status, {
    ...baseHeaders(request),
    ...headers,
  });
  response.end(body);
}

/**
 * Reads a fresh item from the in-memory provider cache.
 *
 * @param {string} key Cache key, usually the full target URL.
 * @returns {{body: Buffer, contentType: string, createdAt: number}|null} Cached item.
 */
function cacheGet(key) {
  const item = memoryCache.get(key);
  if (!item || Date.now() - item.createdAt > CACHE_TTL_MS) {
    memoryCache.delete(key);
    return null;
  }
  return item;
}

/**
 * Stores a provider response in memory with the current timestamp.
 *
 * @param {string} key Cache key.
 * @param {{body: Buffer, contentType: string}} value Provider response data.
 * @returns {void}
 */
function cacheSet(key, value) {
  memoryCache.set(key, { ...value, createdAt: Date.now() });
}

/**
 * Maps a cache key to a deterministic disk-cache JSON path.
 *
 * @param {string} key Cache key.
 * @returns {string} Absolute cache file path.
 */
function cacheFilePath(key) {
  return path.join(DISK_CACHE_DIR, `${createHash("sha256").update(key).digest("hex")}.json`);
}

/**
 * Reads a fresh provider response from the disk cache.
 *
 * @param {string} key Cache key.
 * @returns {Promise<{body: Buffer, contentType: string, createdAt: number}|null>} Cached item.
 */
async function diskCacheGet(key) {
  try {
    const filePath = cacheFilePath(key);
    const fileStat = await stat(filePath);
    if (Date.now() - fileStat.mtimeMs > CACHE_TTL_MS) return null;
    const item = JSON.parse(await readFile(filePath, "utf8"));
    return {
      body: Buffer.from(item.body, "base64"),
      contentType: item.contentType,
      createdAt: item.createdAt,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Writes a provider response to disk as base64 JSON.
 *
 * @param {string} key Cache key.
 * @param {{body: Buffer, contentType: string}} value Provider response data.
 * @returns {Promise<void>}
 */
async function diskCacheSet(key, value) {
  await mkdir(DISK_CACHE_DIR, { recursive: true });
  await writeFile(
    cacheFilePath(key),
    JSON.stringify({
      contentType: value.contentType,
      createdAt: Date.now(),
      body: Buffer.from(value.body).toString("base64"),
    }),
  );
}

/**
 * Reads an upstream body while enforcing the configured maximum response size.
 *
 * @param {Response} upstream Fetch response from an external provider.
 * @returns {Promise<Buffer>} Response body bytes.
 */
async function readLimitedBody(upstream) {
  const contentLength = Number(upstream.headers.get("content-length") || 0);
  if (contentLength > PROXY_MAX_RESPONSE_BYTES) {
    const error = new Error("Upstream response too large");
    error.status = 413;
    throw error;
  }

  const reader = upstream.body?.getReader();
  if (!reader) return Buffer.from(await upstream.arrayBuffer());

  const chunks = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > PROXY_MAX_RESPONSE_BYTES) {
      await reader.cancel();
      const error = new Error("Upstream response too large");
      error.status = 413;
      throw error;
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

/**
 * Proxies a provider URL with cache lookup, size limits, and response headers.
 *
 * @param {string} targetUrl External provider URL.
 * @param {http.IncomingMessage} request Original request.
 * @param {http.ServerResponse} response Response to write.
 * @returns {Promise<void>}
 */
async function proxyFetch(targetUrl, request, response) {
  const cached = cacheGet(targetUrl) || (await diskCacheGet(targetUrl));
  if (cached) {
    send(response, 200, cached.body, {
      "Content-Type": cached.contentType,
      "Cache-Control": "public, max-age=3600",
      "X-Proxy-Cache": "HIT",
    }, request);
    return;
  }

  const upstream = await fetch(targetUrl, {
    signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
    headers: { Accept: "*/*" },
  });
  const body = await readLimitedBody(upstream);
  const contentType = upstream.headers.get("content-type") || "application/octet-stream";

  if (upstream.ok) {
    cacheSet(targetUrl, { body, contentType });
    await diskCacheSet(targetUrl, { body, contentType });
  }

  send(response, upstream.status, body, {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=3600",
    "X-Proxy-Cache": "MISS",
  }, request);
}

/**
 * Checks one provider endpoint and records latency/status for diagnostics.
 *
 * @param {string} id Provider id.
 * @param {string} url Health-check URL.
 * @returns {Promise<{id: string, ok: boolean, status: number, latencyMs: number, error?: string}>}
 */
async function checkProvider(id, url) {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      headers: { Accept: "*/*" },
    });
    return {
      id,
      ok: response.ok,
      status: response.status,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      id,
      ok: false,
      status: 0,
      latencyMs: Date.now() - startedAt,
      error: error.name || "ProviderError",
    };
  }
}

/**
 * Runs provider health checks used by the layer-status UI.
 *
 * @returns {Promise<{ok: boolean, checkedAt: string, providers: unknown[]}>} Health payload.
 */
async function providerHealth() {
  const checks = await Promise.all([
    checkProvider(
      "emodnet",
      `${SOURCES.emodnetWms}?service=WMS&request=GetCapabilities`,
    ),
    checkProvider(
      "gebco",
      `${SOURCES.gebcoWms}?service=WMS&request=GetCapabilities`,
    ),
    checkProvider("openstreetmap", SOURCES.osmTile),
  ]);

  return {
    ok: checks.every((check) => check.ok),
    checkedAt: new Date().toISOString(),
    providers: checks,
  };
}

/**
 * Copies incoming query parameters onto a fixed provider base URL.
 *
 * @param {string} baseUrl Provider base URL.
 * @param {URLSearchParams} searchParams Request query parameters.
 * @returns {string} Full provider URL.
 */
function appendSearch(baseUrl, searchParams) {
  const url = new URL(baseUrl);
  searchParams.forEach((value, key) => url.searchParams.set(key, value));
  return url.toString();
}

const server = http.createServer(async (request, response) => {
  if (!getCorsOrigin(request)) {
    send(response, 403, "Origin not allowed", {}, request);
    return;
  }

  if (request.method === "OPTIONS") {
    send(response, 204, "", {}, request);
    return;
  }

  if (request.method !== "GET") {
    send(response, 405, "Method not allowed", {}, request);
    return;
  }

  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);
    if (request.url.length > MAX_URL_LENGTH) {
      send(response, 414, "URI too long", {}, request);
      return;
    }

    if (requestUrl.pathname === "/api/health") {
      send(response, 200, JSON.stringify({ ok: true }), {
        "Content-Type": "application/json",
      }, request);
      return;
    }

    if (requestUrl.pathname === "/api/provider-health") {
      const health = await providerHealth();
      send(response, health.ok ? 200 : 207, JSON.stringify(health), {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      }, request);
      return;
    }

    if (requestUrl.pathname === "/api/depth") {
      const lat = Number(requestUrl.searchParams.get("lat"));
      const lng = Number(requestUrl.searchParams.get("lng"));
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        send(response, 400, JSON.stringify({ error: "Invalid lat/lng" }), {
          "Content-Type": "application/json",
        }, request);
        return;
      }

      const target = new URL(SOURCES.emodnetDepth);
      target.searchParams.set("geom", `POINT(${lng} ${lat})`);
      await proxyFetch(target.toString(), request, response);
      return;
    }

    if (requestUrl.pathname === "/api/wms/emodnet") {
      await proxyFetch(
        appendSearch(SOURCES.emodnetWms, requestUrl.searchParams),
        request,
        response,
      );
      return;
    }

    if (requestUrl.pathname === "/api/wms/gebco") {
      await proxyFetch(
        appendSearch(SOURCES.gebcoWms, requestUrl.searchParams),
        request,
        response,
      );
      return;
    }

    send(response, 404, "Not found", {}, request);
  } catch (error) {
    const status = error.status || (error.name === "TimeoutError" ? 504 : 502);
    send(response, status, JSON.stringify({ error: error.message }), {
      "Content-Type": "application/json",
    }, request);
  }
});

server.listen(PORT, () => {
  console.log(`Marine Navigator proxy running on http://localhost:${PORT}`);
});
