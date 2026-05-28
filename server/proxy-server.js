/*
    LT: Paprastas Node proxy EMODnet / GEBCO užklausoms, CORS ir cache kontrolei.
    EN: Small Node proxy for EMODnet / GEBCO requests, CORS, and cache control.
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
const ALLOWED_ORIGINS = (process.env.PROXY_ALLOWED_ORIGINS || "*")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const PROVIDER_TIMEOUT_MS = Number(process.env.PROXY_PROVIDER_TIMEOUT_MS || 3000);

const SOURCES = {
  emodnetWms: "https://ows.emodnet-bathymetry.eu/wms",
  gebcoWms: "https://wms.gebco.net/mapserv",
  emodnetDepth: "https://rest.emodnet-bathymetry.eu/depth_sample",
  osmTile: "https://a.tile.openstreetmap.org/0/0/0.png",
};

function getCorsOrigin(request) {
  const requestOrigin = request?.headers.origin;
  if (ALLOWED_ORIGINS.includes("*")) return "*";
  if (!requestOrigin) return ALLOWED_ORIGINS[0] || null;
  if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) return requestOrigin;
  return null;
}

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

function send(response, status, body, headers = {}, request = null) {
  response.writeHead(status, {
    ...baseHeaders(request),
    ...headers,
  });
  response.end(body);
}

function cacheGet(key) {
  const item = memoryCache.get(key);
  if (!item || Date.now() - item.createdAt > CACHE_TTL_MS) {
    memoryCache.delete(key);
    return null;
  }
  return item;
}

function cacheSet(key, value) {
  memoryCache.set(key, { ...value, createdAt: Date.now() });
}

function cacheFilePath(key) {
  return path.join(DISK_CACHE_DIR, `${createHash("sha256").update(key).digest("hex")}.json`);
}

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

  const upstream = await fetch(targetUrl);
  const body = Buffer.from(await upstream.arrayBuffer());
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
    send(response, 502, JSON.stringify({ error: error.message }), {
      "Content-Type": "application/json",
    }, request);
  }
});

server.listen(PORT, () => {
  console.log(`Marine Navigator proxy running on http://localhost:${PORT}`);
});
