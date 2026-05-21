# Marine Navigator

## LT

`Marine Navigator` yra interaktyvi jūrinės navigacijos žiniatinklio aplikacija. Ji naudoja `Leaflet` žemėlapį, realaus laiko naršyklės GPS, dinaminius gylių taškus, sonaro sluoksnį, supaprastintą 3D dugno reljefo sluoksnį ir maršruto planavimą.

### Funkcijos

- Realaus laiko GPS vieta su `navigator.geolocation.watchPosition`.
- Dinaminiai gyliai visame matomame žemėlapio plote, ne tik prie Lietuvos.
- Sonaro sluoksnis su žiedais, skenavimo kryptimi ir `SONAR` etikete.
- Supaprastintas 3D dugno reljefas, persipiešiantis pagal dabartinę žemėlapio zoną.
- Baziniai žemėlapio sluoksniai: pagrindinis, satelitas ir reljefas.
- Maršruto taškų pridėjimas paspaudus žemėlapį.
- Maršruto atstumo skaičiavimas ir maršruto išvalymas.
- Modalinis meniu langas, kad nustatymai neužkrautų pagrindinio žemėlapio vaizdo.
- Kalbos perjungimas: LT / EN.
- Temos perjungimas: diena / naktis.
- Offline zonos išsaugojimas ir atkūrimas naudojant `localStorage`.

### Kaip paleisti

1. Atidarykite projektą VS Code.
2. Paleiskite `index.html` per VS Code Live Server.
3. Jei pakeitimai iš karto nesimato, naršyklėje paspauskite `Ctrl + F5`.

Rekomenduojama naudoti Live Server, nes GPS leidimai ir išoriniai žemėlapių sluoksniai patikimiau veikia per lokalų serverį nei tiesiogiai atidarius failą.

### Pastabos

- Programa naudoja išorinius žemėlapių šaltinius, todėl reikalingas interneto ryšys.
- Jei žemėlapis nerodomas, patikrinkite ar naršyklė arba plėtiniai neblokuoja `unpkg.com`, `openstreetmap.org` arba `arcgisonline.com`.
- Gylių, sonaro ir 3D reljefo sluoksniai yra vizualinė simuliacija, skirta aplikacijos demonstracijai.

## EN

`Marine Navigator` is an interactive marine navigation web application. It uses a `Leaflet` map, browser-based real-time GPS, dynamic depth markers, a sonar overlay, a simplified 3D seabed relief overlay, and route planning.

### Features

- Real-time GPS location with `navigator.geolocation.watchPosition`.
- Dynamic depth markers across the whole visible map area, not only near Lithuania.
- Sonar overlay with rings, scan direction, and a `SONAR` label.
- Simplified 3D seabed relief that redraws based on the current map view.
- Base map layers: default, satellite, and terrain.
- Add route waypoints by clicking the map.
- Route distance calculation and route clearing.
- Modal menu window so settings do not take over the main map view.
- Language switch: LT / EN.
- Theme switch: day / night.
- Offline area save and restore using `localStorage`.

### How To Run

1. Open the project in VS Code.
2. Run `index.html` with VS Code Live Server.
3. If changes do not appear immediately, press `Ctrl + F5` in the browser.

Live Server is recommended because GPS permissions and external map layers work more reliably through a local server than by opening the file directly.

### Notes

- The app uses external map sources, so an internet connection is required.
- If the map does not appear, check whether the browser or extensions are blocking `unpkg.com`, `openstreetmap.org`, or `arcgisonline.com`.
- Depth, sonar, and 3D relief layers are a visual simulation for app demonstration.

## LovLaus Copyright

![LovLaus logo](media/logo/LovLaus%20logo.png)

© LovLaus
