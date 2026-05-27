# Marine Navigator

## LT

`Marine Navigator` yra interaktyvi jūrinės navigacijos žiniatinklio aplikacija. Ji naudoja `Leaflet` žemėlapį, realaus laiko naršyklės GPS, realius EMODnet batimetrijos sluoksnius, GEBCO dugno reljefą ir maršruto planavimą.

### Funkcijos

- Realaus laiko GPS vieta su `navigator.geolocation.watchPosition`.
- Realūs batimetrijos sluoksniai iš EMODnet WMS.
- Realus gylio mėginys per lokalų proxy su tiesioginiu EMODnet fallback.
- Matavimų / šaltinių sluoksnis iš EMODnet Bathymetry.
- GEBCO WMS shaded relief sluoksnis tikram dugno reljefui.
- Baziniai žemėlapio sluoksniai: pagrindinis, satelitas ir reljefas.
- Maršruto taškų pridėjimas paspaudus žemėlapį.
- Maršruto taškų sąrašas su galimybe ištrinti atskirus taškus.
- Maršruto atstumo skaičiavimas ir maršruto išvalymas.
- GPX maršrutų importas ir eksportas.
- Maršrutų istorijos išsaugojimas naršyklėje.
- Greitas dviejų taškų atstumo matavimas.
- MOB / SOS taško pažymėjimas su koordinačių nukopijavimu.
- GPS greičio ir krypties rodymas.
- Minimalaus saugaus gylio nustatymas ir seklumos įspėjimas realaus gylio popup lange.
- Žemėlapio orientacija pagal šiaurę arba maršruto kryptį.
- GPS paleidimas ir sustabdymas.
- Gylių legenda ant žemėlapio.
- Modalinis meniu langas, kad nustatymai neužkrautų pagrindinio žemėlapio vaizdo.
- Kompaktiškas sluoksnių valdiklis, kuris neuždengia žemėlapio, kai nėra naudojamas.
- Aiškios aktyvios GPS ir maršruto taško mygtukų būsenos.
- Kalbos perjungimas: LT / EN.
- Temos perjungimas: diena / naktis.
- Pasirinktos zonos atsisiuntimas pagal `min/max zoom`, progresas ir plytelių cache.
- PWA metaduomenys per `manifest.json`, kad appą būtų galima įdiegti palaikomose naršyklėse.
- PWA įdiegimo mygtukas, offline cache statusas ir cache išvalymas.
- Vietiniai `Leaflet` ir `leaflet-rotate` failai `vendor/` aplanke, todėl pirmas app shell paleidimas nebepriklauso nuo CDN.
- Vite build/dev serveris, Node proxy serveris, Playwright testai ir Capacitor Android/iOS projektai.

### Kaip paleisti

1. Įdiekite priklausomybes: `npm install`.
2. Paleiskite proxy serverį: `npm run proxy`.
3. Kitame terminale paleiskite appą: `npm run dev`.
4. Atidarykite `http://localhost:5173`.

### Komandos

- `npm run dev` - Vite dev serveris.
- `npm run proxy` - EMODnet / GEBCO proxy ir cache serveris.
- `npm run build` - produkcinis build į `dist/`.
- `npm test` - Playwright testai desktop ir mobile Chromium profiliuose.
- `npm run cap:sync` - nukopijuoja `dist/` į Android/iOS Capacitor projektus.
- `npm run cap:open:android` - atidaro Android projektą.
- `npm run cap:open:ios` - atidaro iOS projektą.

### Mobilios platformos

- Android projektas yra `android/`.
- iOS projektas yra `ios/`.
- Prieš sync paleiskite `npm run build`, tada `npm run cap:sync`.
- Android build’ui reikia Android Studio / SDK.
- iOS build’ui reikia macOS su Xcode, net jei iOS projektas sugeneruotas šiame repo.

### Pastabos

- Programa naudoja išorinius žemėlapių šaltinius, todėl reikalingas interneto ryšys.
- Jei žemėlapis nerodomas, patikrinkite ar naršyklė arba plėtiniai neblokuoja `openstreetmap.org`, `arcgisonline.com`, `emodnet-bathymetry.eu` arba `gebco.net`.
- Offline plytelių cache ir įdiegiamas PWA režimas veikia per `service-worker.js` ir `manifest.json`, todėl appą reikia paleisti per HTTP/HTTPS serverį, o ne tiesiogiai atidaryti kaip failą.
- Proxy serveris sumažina CORS/cache problemas gylio ir WMS užklausoms, bet WMS sluoksniai app’e palikti tiesioginiai, kad veiktų ir Capacitor / statiniame hostinge.
- Batimetrijos sluoksniai priklauso nuo išorinių EMODnet ir GEBCO servisų ir nėra skirti realiems navigacijos saugumo sprendimams.

## EN

`Marine Navigator` is an interactive marine navigation web application. It uses a `Leaflet` map, browser-based real-time GPS, real EMODnet bathymetry layers, GEBCO seabed relief, and route planning.

### Features

- Real-time GPS location with `navigator.geolocation.watchPosition`.
- Real bathymetry from EMODnet WMS layers.
- Real depth sample lookup through the local proxy with direct EMODnet fallback.
- Survey/source reference overlay from EMODnet Bathymetry.
- GEBCO WMS shaded relief layer for real seabed terrain.
- Base map layers: default, satellite, and terrain.
- Add route waypoints by clicking the map.
- Waypoint list with per-point delete actions.
- Route distance calculation and route clearing.
- GPX route import and export.
- Saved route history in the browser.
- Quick two-point distance measurement.
- MOB / SOS point marker with coordinate copy.
- GPS speed and heading display.
- Minimum safe depth setting with shallow-water warning in the real depth popup.
- Map orientation by north-up or route-heading-up mode.
- GPS start and stop controls.
- Depth legend on the map.
- Modal menu window so settings do not take over the main map view.
- Compact layer control that does not cover the map when it is not being used.
- Clear active states for the GPS and waypoint buttons.
- Language switch: LT / EN.
- Theme switch: day / night.
- Selected area download by `min/max zoom`, progress, and tile cache.
- PWA metadata through `manifest.json` so the app can be installed in supported browsers.
- PWA install button, offline cache status, and cache clearing.
- Local `Leaflet` and `leaflet-rotate` files in `vendor/`, so the first app shell no longer depends on a CDN.
- Vite build/dev server, Node proxy server, Playwright tests, and Capacitor Android/iOS projects.

### How To Run

1. Install dependencies: `npm install`.
2. Start the proxy server: `npm run proxy`.
3. In another terminal, start the app: `npm run dev`.
4. Open `http://localhost:5173`.

### Commands

- `npm run dev` - Vite dev server.
- `npm run proxy` - EMODnet / GEBCO proxy and cache server.
- `npm run build` - production build into `dist/`.
- `npm test` - Playwright tests for desktop and mobile Chromium profiles.
- `npm run cap:sync` - copies `dist/` into Android/iOS Capacitor projects.
- `npm run cap:open:android` - opens the Android project.
- `npm run cap:open:ios` - opens the iOS project.

### Mobile Platforms

- Android project: `android/`.
- iOS project: `ios/`.
- Before sync, run `npm run build`, then `npm run cap:sync`.
- Android builds require Android Studio / SDK.
- iOS builds require macOS with Xcode, even though the iOS project is generated in this repo.

### Notes

- The app uses external map sources, so an internet connection is required.
- If the map does not appear, check whether the browser or extensions are blocking `openstreetmap.org`, `arcgisonline.com`, `emodnet-bathymetry.eu`, or `gebco.net`.
- Offline tile caching and installable PWA mode use `service-worker.js` and `manifest.json`, so run the app through an HTTP/HTTPS server instead of opening it directly as a file.
- The proxy server reduces CORS/cache issues for depth and WMS requests, but WMS layers stay direct in the app so they also work in Capacitor / static hosting.
- Bathymetry layers depend on external EMODnet and GEBCO services and are not intended for real navigation safety decisions.

## LovLaus Copyright

![LovLaus logo](media/logo/LovLaus%20logo.png)

© LovLaus
