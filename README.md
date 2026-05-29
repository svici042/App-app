# Marine Navigator

Marine Navigator is a map-first marine navigation assistant built as a web/PWA app with Capacitor Android/iOS projects. It supports GPS tracking, route planning, GPX import/export, offline map regions, EMODnet bathymetry overlays, EMODnet point depth queries, and provider metadata/status display.

This app is not a certified ECDIS or primary navigation system. Depth and bathymetry data are advisory only.

## Architecture Overview

The app is intentionally small and mostly client-side:

- `index.html` defines the static shell, map container, sidebar panels, depth diagnostics, and PWA metadata.
- `src/main.js` is the application controller. It wires the map, GPS, navigation modes, route editing, GPX import/export, offline downloads, depth queries, WMS synchronization, and UI state.
- `src/config.js` centralizes providers, cache keys, proxy paths, WMS endpoints, and depth-source metadata.
- `src/map.js` creates the Leaflet map and custom WMS panes. WMS panes are children of Leaflet's tile pane so rotation stays synchronized.
- `src/routes.js` contains pure navigation math and route-history parsing.
- `src/offline.js` converts map bounds to slippy-map tile URLs and estimates cache size.
- `src/gps.js` bridges browser geolocation and Capacitor Geolocation.
- `src/pwa.js` wraps Web Share, Capacitor Share, and Capacitor Filesystem.
- `service-worker.js` pre-caches the app shell and maintains a capped runtime cache for map/runtime GET responses.
- `server/proxy-server.js` is a same-origin proxy for EMODnet/GEBCO/provider-health requests with CORS allowlisting, timeout limits, response-size limits, memory cache, and disk cache.
- `tests/` contains Playwright UI regressions and Node unit tests for navigation math/GPX contracts.

## Folder Structure

- `android/` - Capacitor Android project.
- `ios/` - Capacitor iOS project.
- `media/` - icons and LovLaus logo assets.
- `scripts/copy-static.js` - copies service worker, manifest, icons, and logo into `dist/` after build.
- `server/` - local provider proxy.
- `src/` - application source modules.
- `tests/` - Playwright and Node tests.
- `vendor/` - local Leaflet and Leaflet rotation plugin files.
- `dist/` - generated production build output.

## Navigation Modes

- **North-up**: map bearing is forced to `0`. The North button resets rotation and updates the active UI state.
- **Heading-up**: map bearing follows the best available heading. Preference order is GPS heading/course, inferred movement bearing, then latest route segment bearing.
- **Follow mode**: map follows the current GPS position and also applies heading-up behavior when heading/course data is available.

The app keeps WMS bathymetry panes synchronized with the rotated Leaflet tile pane. WMS redraws are debounced after zoom, pan, and rotation events to reduce Android flicker.

## Map Providers

Configured base-map providers live in `src/config.js`:

- OpenStreetMap: community base map.
- Esri World Imagery: satellite imagery reference layer.
- Esri World Topo Map: terrain/topographic reference layer.

Provider metadata includes display name, layer type, data type, attribution, license URL when known, offline allowance status, quality, and safety use. No provider is presented as certified for primary navigation.

## Depth And Bathymetry Providers

Configured depth-related providers:

- **EMODnet Bathymetry**: primary bathymetry source for WMS contours/source layers and numeric depth query endpoint.
- **GEBCO relief**: optional approximate visual seabed relief only. It is not numeric depth soundings.
- **Experimental 3D seabed**: not implemented and hidden/disabled until a real renderer exists.

Continuous depth visibility defaults to EMODnet contours where provider tiles render. Numeric depth is requested by tap/click through `/api/depth`, which proxies EMODnet REST depth samples.

## Offline Support

Offline support has two layers:

- The service worker caches app shell/runtime GET responses and can serve the latest app shell offline.
- The offline-region UI explicitly downloads visible base-map tiles for selected bounds and zoom levels into the Cache API.

Offline regions store metadata in localStorage: name, bounds, center, zoom range, base layer, tile URLs, estimated bytes, and cached tile count. The app does not invent offline bathymetry coverage; if depth data is not available for an offline area, the UI says so.

## Development

Install dependencies:

```bash
npm install
```

Run the provider proxy:

```bash
npm run proxy
```

Run the HTTPS Vite dev server:

```bash
npm run dev
```

Open:

```text
https://localhost:5173
```

The dev server proxies `/api` to `http://localhost:8787`.

## Build

Production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Android Build

Build the web app and sync Capacitor:

```bash
npm run build
npx cap sync android
```

Open Android Studio:

```bash
npx cap open android
```

Android requires Android Studio/SDK. The Android manifest includes internet and coarse/fine location permissions.

## Testing

Syntax check:

```bash
npm run check
```

Production build verification:

```bash
npm run build
```

Full test suite:

```bash
npm test
```

Playwright starts the proxy and HTTPS Vite server automatically. It runs desktop Chromium and Pixel-sized mobile Chromium projects. The suite covers map shell loading, collapsible UI, North/Heading/Follow controls, WMS redraw behavior, depth tap queries, provider metadata, offline UI, and fallback/3D safety semantics.

## Proxy Configuration

Environment variables:

- `PORT` - proxy port, default `8787`.
- `PROXY_ALLOWED_ORIGINS` - comma-separated CORS allowlist. Defaults to local Vite origins.
- `PROXY_PROVIDER_TIMEOUT_MS` - provider-health timeout, default `3000`.
- `PROXY_TIMEOUT_MS` - upstream proxy timeout, default `10000`.
- `PROXY_MAX_RESPONSE_BYTES` - maximum upstream response size, default `15728640` bytes.

Endpoints:

- `/api/health` - local proxy liveness.
- `/api/provider-health` - EMODnet, GEBCO, and OpenStreetMap status.
- `/api/depth?lat=...&lng=...` - proxied EMODnet numeric depth sample.
- `/api/wms/emodnet` - proxied EMODnet WMS.
- `/api/wms/gebco` - proxied GEBCO WMS.

## Safety Notes

- Marine Navigator is advisory software, not a certified ECDIS.
- Depth and bathymetry data depend on external provider coverage, quality, availability, and licensing.
- GEBCO relief is visual-only and must not be treated as numeric soundings.
- Offline base-map downloads do not guarantee offline depth coverage.
- Always verify navigation decisions with official charts and appropriate onboard instruments.

## LovLaus Copyright

![LovLaus logo](media/logo/LovLaus%20logo.png)

© LovLaus
