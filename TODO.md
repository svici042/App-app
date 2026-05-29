# # TODO — Marine Offline Navigator

## ✅ Atlikta. ## DONE.

* [x] LT/EN language switch, Day/Night theme, dynamic UI texts.
* [x] GPS start/stop UI, waypoint mode, clear route behavior.
* [x] Smaller controls and larger map area.
* [x] Waypoint list, waypoint delete, GPX import/export, route history.
* [x] MOB/SOS, GPS speed/heading, measure mode, safe depth warning.
* [x] EMODnet depth query, GEBCO seabed relief, depth legend, layer control.
* [x] PWA manifest, icons, install button, service worker, offline status, cache clear.
* [x] Local Leaflet and leaflet-rotate vendor files.
* [x] Vite dev/build system.
* [x] App split into ES modules: map, gps, routes, offline, pwa, i18n, ui, config.
* [x] Offline region download by map bounds and zoom levels.
* [x] Offline size estimate, progress, cancel button, storage/cache quota display.
* [x] Node EMODnet/GEBCO proxy with CORS, whitelist, security headers and `.proxy-cache/`.
* [x] Capacitor Android/iOS projects.
* [x] Capacitor plugins: Geolocation, Filesystem, Share.
* [x] Android location/internet permissions and iOS location descriptions.
* [x] Playwright tests for main desktop/mobile flows.
* [x] GitHub Actions CI with `npm run check`, `npm run build`, `npm test`.
* [x] README in Lithuanian and English.
* [x] Service worker cache version updated.
* [x] Offline download manifest: name, bounds, zoom levels, size, date, delete UI.
* [x] Production proxy CORS allowlist through `PROXY_ALLOWED_ORIGINS`.
* [x] Provider health indicator for EMODnet, GEBCO, OpenStreetMap.
* [x] Proxy production safety: local CORS allowlist, upstream timeout, response size limit.
* [x] Limited service worker runtime cache pruning.
* [x] Android backup disabled in manifest.
* [x] Navigation unit tests added.
* [x] Depth diagnostics added.
* [x] Provider metadata registry added.
* [x] Separated numeric depths, depth contours, seabed relief and experimental 3D bathymetry.

## Priority 1 — UI Ergonomics (Map-First Design)

* [ ] Make the map the primary visible element on all screen sizes.
* [ ] Reduce permanent UI footprint on desktop and mobile.
* [ ] Convert the left sidebar into a collapsible panel.
* [ ] Show a compact floating menu button when the sidebar is collapsed.
* [ ] Convert the depth/status diagnostics panel into a collapsible widget.
* [ ] Show a small status chip when diagnostics are collapsed.
* [ ] Implement smooth open/close animations for all panels.
* [ ] On mobile, open navigation/settings as slide-in drawers.
* [ ] Close drawers automatically when tapping outside.
* [ ] Ensure no panel permanently blocks important map content.
* [ ] Preserve full accessibility (ARIA labels, keyboard navigation).
* [ ] Add responsive Playwright tests for desktop and mobile layouts.
* [ ] Add compact mode optimized for marine navigation while underway.

### Design Principle

Map First.

The map should occupy the maximum possible screen area.
All controls should be available within one tap/click, but remain hidden when not actively used.

Target:

* Desktop: 80–90% of screen dedicated to the map.
* Mobile: 90–95% of screen dedicated to the map.

## Priority 2 — Navigation Visualization

### Night Navigation Mode

* [ ] Add a dedicated marine night chart mode.
* [ ] Use red/amber low-luminance UI elements to preserve night vision.
* [ ] Reduce white backgrounds and bright map labels.
* [ ] Add a one-tap Night Navigation toggle.
* [ ] Automatically dim UI overlays in night mode.
* [ ] Ensure depth labels and route lines remain readable at night.
* [ ] Add optional automatic switching based on local sunset/sunrise.

### Bathymetry Visualization Improvements

* [ ] Replace the current colorized depth raster as the default depth visualization.
* [ ] Add bathymetric contour lines (isobaths) as the primary depth layer.
* [ ] Keep contour labels readable at multiple zoom levels.
* [ ] Allow enabling colorized bathymetry as an optional layer.
* [ ] Add contour intervals suitable for coastal navigation.
* [ ] Preserve map readability when depth layers are enabled.
* [ ] Add separate toggles for:

  * Depth Contours
  * Depth Labels
  * Color Bathymetry
  * Seabed Relief
  * Experimental 3D Bathymetry

### Design Principle

Navigation information must improve situational awareness.

Depth layers should never reduce map readability or obscure coastline details.

Contour-based bathymetry should be the default navigation view, while colorized bathymetry should remain optional.



## 🔴 Priority 1.1 — Stability and safety

* [ ] Commit current clean state before next changes.
* [ ] Improve native Android GPS flow through Capacitor Geolocation.
* [ ] Add clear first-launch safety notice: not ECDIS, advisory only, not primary navigation.
* [ ] Add visible data-quality warnings for depth/bathymetry layers.
* [ ] Add provider attribution and license audit for every map/depth provider.
* [ ] Add tests for GPS permission states: granted, denied, unavailable.

## 🟠 Priority 2.2 — Offline reliability

* [ ] Clearly separate browser dev mode from installed Android/iOS app behavior.
* [ ] Add offline-region completeness check.
* [ ] Show whether selected offline region contains base map, depth layer, relief layer, or only partial data.
* [ ] Add warning when user leaves downloaded offline region.
* [ ] Add e2e tests for offline download cancel, failure, retry and delete.
* [ ] Replace manual PWA service worker with `vite-plugin-pwa` or Workbox later.

## 🟡 Priority 3 — Navigation functionality

* [ ] Improve route editing: reorder points, rename points, notes.
* [ ] Add route library: save, load, duplicate, delete named routes.
* [ ] Add cross-track error calculation.
* [ ] Add ETA calculation using speed over ground.
* [ ] Add route safety corridor warning where depth data exists.
* [ ] Add antimeridian and polar edge-case tests.

## 🟢 Priority 4 — Marine layers

* [ ] Add nautical safety layers: ports, lighthouses, navigation marks, restricted areas.
* [ ] Investigate legal worldwide chart/depth sources.
* [ ] Add official ENC adapter architecture, but do not implement illegal chart scraping.
* [ ] Add fallback logic only with honest quality labels.
* [ ] Keep GEBCO as approximate visual seabed relief, not numeric depth soundings.
* [ ] Keep experimental 3D bathymetry disabled by default.

## 🔵 Priority 5 — Native app release

* [ ] Android release signing.
* [ ] Android App Bundle generation.
* [ ] Automatic version numbering.
* [ ] Real-device Android GPS testing.
* [ ] iOS release later through macOS + Xcode.
* [ ] App Store / Google Play privacy text.
* [ ] Optional crash/error reporting.

## ⚫ Later / not now

* [ ] Native background geolocation with clear privacy settings.
* [ ] Battery saving navigation mode.
* [ ] SQLite proxy cache with TTL, size limits and admin cleanup endpoint.
* [ ] Lighthouse/PWA audit in CI.
* [ ] Local diagnostic log export.
* [ ] Desktop app packaging with Tauri or Electron.
