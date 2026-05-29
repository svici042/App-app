# Marine Navigator

## LT

`Marine Navigator` yra interaktyvi jūrinės navigacijos PWA aplikacija su realiais EMODnet batimetrijos sluoksniais, GEBCO dugno reljefu, GPS sekimu, maršrutais, offline zona ir Capacitor Android/iOS projektais.

### Funkcijos

- `Leaflet` žemėlapis bundlinamas per Vite iš lokalių `vendor/` failų.
- CSS failai kraunami per `index.html`, todėl appas neužlūžta ir paprastame statiniame serveryje.
- Tikri EMODnet batimetrijos WMS sluoksniai ir GEBCO shaded relief dugno reljefas.
- Realaus gylio mėginiai per lokalų proxy su tiesioginiu EMODnet fallback.
- Tiekėjų būsenos indikatorius rodo EMODnet, GEBCO ir OpenStreetMap pasiekiamumą.
- GPS sekimas, greitis, kryptis, GPS start/stop ir žemėlapio orientacija pagal šiaurę arba maršruto kryptį.
- Maršruto taškai, atstumo skaičiavimas, taškų trynimas, GPX importas/eksportas ir maršrutų istorija.
- MOB/SOS taškas su koordinačių bendrinimu.
- Greitas dviejų taškų matavimas.
- Saugus minimalus gylis ir seklumos įspėjimas realaus gylio lange.
- Kompaktiškas sluoksnių valdiklis, kuris susitraukia nenaudojamas.
- LT/EN kalbos, dienos/nakties tema ir mažesni ergonomiški valdikliai.
- Offline zonos atsisiuntimas pagal pasirinktą plotą ir zoom lygius su dydžio įvertinimu, progresu, atšaukimu, cache kvotos rodymu ir išsaugotų zonų manifestu.
- PWA manifestas, service worker, install mygtukas, offline statusas ir cache išvalymas.
- Capacitor native pluginai: Geolocation, Filesystem ir Share.
- Node proxy serveris su env valdomu CORS allowlist, saugumo headeriais, provider health endpointu ir diskiniu `.proxy-cache/` cache.
- Playwright testai ir GitHub Actions CI (`check`, `build`, `test`).

### Projekto struktūra

- `index.html` - Vite entry HTML.
- `src/main.js` - pagrindinė app logika ir modulinių dalių sujungimas.
- `src/map.js` - žemėlapio kūrimas ir pane sluoksniai.
- `src/gps.js` - naršyklės/native GPS pagalbinės funkcijos.
- `src/routes.js` - maršrutų, atstumų ir krypčių skaičiavimai.
- `src/offline.js` - offline plytelių URL generavimas, dydžio įvertinimas ir formatavimas.
- `src/pwa.js` - native/web share ir filesystem integracijos.
- `src/i18n.js` - LT/EN tekstai.
- `src/ui.js` - bendros UI pagalbinės funkcijos.
- `server/proxy-server.js` - EMODnet/GEBCO proxy ir cache serveris.
- `tests/app.spec.js` - Playwright patikrinimai.
- `android/`, `ios/` - Capacitor mobilūs projektai.

### Kaip paleisti

1. Įdiekite priklausomybes: `npm install`.
2. Paleiskite proxy serverį: `npm run proxy`.
3. Kitame terminale paleiskite appą: `npm run dev`.
4. Atidarykite `http://localhost:5173`.

### Komandos

- `npm run dev` - Vite dev serveris.
- `npm run proxy` - EMODnet / GEBCO proxy ir diskinis cache serveris.
- `npm run check` - sintaksės patikrinimas svarbiausiems JS failams.
- `npm run build` - produkcinis build į `dist/`.
- `npm run preview` - lokali produkcinio build peržiūra.
- `npm test` - Playwright testai desktop ir mobile Chromium profiliuose.
- `npm run cap:sync` - nukopijuoja `dist/` į Android/iOS Capacitor projektus.
- `npm run cap:open:android` - atidaro Android projektą.
- `npm run cap:open:ios` - atidaro iOS projektą.

### Mobilios platformos

- Android projektas yra `android/`.
- iOS projektas yra `ios/`.
- Prieš sync paleiskite `npm run build`, tada `npm run cap:sync`.
- Android build’ui reikia Android Studio / SDK.
- iOS build’ui reikia macOS su Xcode.
- Android manifestas turi interneto ir tikslios/apytikslės lokacijos teises.
- iOS `Info.plist` turi lokacijos naudojimo aprašymus.

### Proxy konfigūracija

- `PORT` - proxy portas, pagal nutylėjimą `8787`.
- `PROXY_ALLOWED_ORIGINS` - kableliais atskirtas CORS origin allowlist. Pagal nutylėjimą leidžiami tik lokalūs Vite originai (`localhost` / `127.0.0.1` ant `5173` ir `4173`). Produkcijai nustatykite konkrečius domenus, pvz. `https://example.com,https://app.example.com`.
- `PROXY_PROVIDER_TIMEOUT_MS` - provider health patikros timeout milisekundėmis, pagal nutylėjimą `3000`.
- `PROXY_TIMEOUT_MS` - upstream proxy užklausų timeout milisekundėmis, pagal nutylėjimą `10000`.
- `PROXY_MAX_RESPONSE_BYTES` - maksimalus vieno upstream atsakymo dydis baitais, pagal nutylėjimą `15728640` (15 MB).
- `/api/health` - paprastas proxy gyvybingumo patikrinimas.
- `/api/provider-health` - EMODnet, GEBCO ir OpenStreetMap pasiekiamumo bei latency patikrinimas.

### Saugumo pastabos

- Appas nėra sertifikuota navigacijos saugumo sistema. Batimetrija priklauso nuo EMODnet/GEBCO servisų prieinamumo ir tikslumo.
- Proxy leidžia tik whitelist’intus EMODnet/GEBCO/OpenStreetMap hostus, riboja URL ilgį, prideda `nosniff`, `no-referrer` ir CORP headerius.
- Produkcijoje nustatykite `PROXY_ALLOWED_ORIGINS`, kad CORS veiktų tik su leidžiamais domenais.
- Proxy riboja upstream užklausų trukmę ir atsakymo dydį, kad provider klaidos neišpūstų cache ar neužkabintų proceso.
- Offline cache gali užimti daug vietos, todėl prieš atsisiuntimą rodoma dydžio ir kvotos informacija, o išsaugotas zonas galima trinti atskirai.

## EN

`Marine Navigator` is an interactive marine navigation PWA with real EMODnet bathymetry layers, GEBCO seabed relief, GPS tracking, route planning, offline area downloads, and Capacitor Android/iOS projects.

### Features

- `Leaflet` map bundled by Vite from local `vendor/` files.
- CSS files are loaded through `index.html`, so the app also avoids crashes on a plain static server.
- Real EMODnet bathymetry WMS layers and GEBCO shaded seabed relief.
- Real depth samples through the local proxy with direct EMODnet fallback.
- Provider status indicator shows EMODnet, GEBCO, and OpenStreetMap availability.
- GPS tracking, speed, heading, GPS start/stop, and north-up or route-heading-up map orientation.
- Route waypoints, distance calculation, waypoint deletion, GPX import/export, and route history.
- MOB/SOS marker with coordinate sharing.
- Quick two-point distance measurement.
- Minimum safe depth and shallow-water warning in the real depth popup.
- Compact layer control that collapses when unused.
- LT/EN language switch, day/night theme, and smaller ergonomic controls.
- Offline area download by selected bounds and zoom levels with size estimate, progress, cancel action, cache quota display, and a saved-area manifest.
- PWA manifest, service worker, install button, offline status, and cache clearing.
- Capacitor native plugins: Geolocation, Filesystem, and Share.
- Node proxy server with env-controlled CORS allowlist, security headers, provider health endpoint, and disk-backed `.proxy-cache/`.
- Playwright tests and GitHub Actions CI (`check`, `build`, `test`).

### Project Structure

- `index.html` - Vite entry HTML.
- `src/main.js` - main app logic and module composition.
- `src/map.js` - map creation and pane setup.
- `src/gps.js` - browser/native GPS helpers.
- `src/routes.js` - route, distance, and bearing calculations.
- `src/offline.js` - offline tile URL generation, size estimates, and formatting.
- `src/pwa.js` - native/web share and filesystem integrations.
- `src/i18n.js` - LT/EN text dictionary.
- `src/ui.js` - shared UI helpers.
- `server/proxy-server.js` - EMODnet/GEBCO proxy and cache server.
- `tests/app.spec.js` - Playwright checks.
- `android/`, `ios/` - Capacitor mobile projects.

### How To Run

1. Install dependencies: `npm install`.
2. Start the proxy server: `npm run proxy`.
3. In another terminal, start the app: `npm run dev`.
4. Open `http://localhost:5173`.

### Commands

- `npm run dev` - Vite dev server.
- `npm run proxy` - EMODnet / GEBCO proxy and disk cache server.
- `npm run check` - syntax check for the key JS files.
- `npm run build` - production build into `dist/`.
- `npm run preview` - local preview of the production build.
- `npm test` - Playwright tests for desktop and mobile Chromium profiles.
- `npm run cap:sync` - copies `dist/` into Android/iOS Capacitor projects.
- `npm run cap:open:android` - opens the Android project.
- `npm run cap:open:ios` - opens the iOS project.

### Mobile Platforms

- Android project: `android/`.
- iOS project: `ios/`.
- Before sync, run `npm run build`, then `npm run cap:sync`.
- Android builds require Android Studio / SDK.
- iOS builds require macOS with Xcode.
- The Android manifest includes internet and coarse/fine location permissions.
- iOS `Info.plist` includes location usage descriptions.

### Proxy Configuration

- `PORT` - proxy port, defaults to `8787`.
- `PROXY_ALLOWED_ORIGINS` - comma-separated CORS origin allowlist. Defaults to local Vite origins only (`localhost` / `127.0.0.1` on `5173` and `4173`). In production, set explicit domains, e.g. `https://example.com,https://app.example.com`.
- `PROXY_PROVIDER_TIMEOUT_MS` - provider health timeout in milliseconds, defaults to `3000`.
- `PROXY_TIMEOUT_MS` - upstream proxy request timeout in milliseconds, defaults to `10000`.
- `PROXY_MAX_RESPONSE_BYTES` - maximum size for one upstream response in bytes, defaults to `15728640` (15 MB).
- `/api/health` - simple proxy liveness check.
- `/api/provider-health` - EMODnet, GEBCO, and OpenStreetMap availability and latency check.

### Security Notes

- The app is not a certified navigation safety system. Bathymetry depends on EMODnet/GEBCO service availability and accuracy.
- The proxy only calls whitelisted EMODnet/GEBCO/OpenStreetMap hosts, limits URL length, and adds `nosniff`, `no-referrer`, and CORP headers.
- In production, set `PROXY_ALLOWED_ORIGINS` so CORS only works for approved domains.
- The proxy limits upstream request duration and response size so provider failures cannot grow cache or hold the process indefinitely.
- Offline cache can use significant storage, so the app shows size and quota information before download and allows deleting saved areas individually.

## LovLaus Copyright

![LovLaus logo](media/logo/LovLaus%20logo.png)

© LovLaus
