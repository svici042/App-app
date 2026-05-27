# TODO

- [x] 1) `index.html`: pridėti LT/EN mygtuką, Day/Night theme mygtuką, pridėti trūkstamą `clear-route` mygtuką, sukurti UI elementus i18n keitimui.
- [x] 2) `styles.css`: įdiegti light ir dark theme (CSS kintamieji), sukurti stylingą theme togglui.
- [x] 3) `app.js`: pridėti i18n žodyną (LT/EN), perjungimą + `document.lang` atnaujinimą; pridėti theme toggle su localStorage; įdiegti waypoint mode; sutvarkyti dynamic tekstus (gps-status, route-distance, boat-summary/range, offline-status).
- [x] 4) `README.md`: pridėti aprašymą, kaip paleisti, ir LovLaus copyright su logo iš `media/logo/LovLaus logo.png`.
- [x] 5) Patikrinti funkcionalumą: GPS mygtukas, Add waypoint mode, Clear route, offline save/load, tab’ai, LT/EN, Day/Night.
- [x] 6) Ergonomika: sumažinti mygtukus, padidinti žemėlapio plotą, pašalinti nereikalingus tekstus po žemėlapiu.
- [x] 7) Navigacija: pridėti GPS stop, maršruto taškų sąrašą su trynimu ir šiaurės / maršruto krypties orientaciją.
- [x] 8) Žemėlapiai: sutvarkyti GEBCO 3D reljefo sluoksnį, pridėti gylių legendą ir matomų plytelių cache per service worker.
- [x] 9) PWA: pridėti `manifest.json`, app ikonėles, install mygtuką, PWA statusą ir cache išvalymą.
- [x] 10) Navigacijos funkcijos: MOB/SOS, GPS greitis/kryptis, matavimo režimas, GPX import/export, maršrutų istorija.
- [x] 11) Saugumas: pridėti minimalaus saugaus gylio nustatymą ir seklumos įspėjimą realaus gylio popup lange.

## Tolimesni upgrade'ai

- [x] Perkelti Leaflet ir `leaflet-rotate` į lokalius vendor failus.
- [x] Pridėti Vite build/dev serverį.
- [x] Sukurti offline zonos atsisiuntimą pagal dabartinį žemėlapio plotą ir pasirinktus zoom lygius su progresu.
- [x] Sukurti backend/proxy EMODnet ir GEBCO užklausoms su CORS ir atminties cache.
- [x] Pridėti Playwright testus pagrindinėms vartotojo eigoms.
- [x] Supakuoti appą su Capacitor į Android/iOS projektų struktūrą.

## Kiti modernizavimo etapai

- [ ] Perkelti `app.js` į ES modulius: `map`, `gps`, `routes`, `offline`, `pwa`, `i18n`, `ui`.
- [ ] Pakeisti klasikinius `<script>` į Vite bundlinamus modulius, kad build nebereikėtų papildomo static copy žingsnio.
- [ ] Pridėti offline zonos dydžio skaičiavimą prieš atsisiuntimą, atsisiuntimo atšaukimą ir cache kvotas.
- [ ] Padaryti pasirenkamą proxy režimą WMS sluoksniams su UI jungikliu.
- [ ] Pridėti backend persistent cache į diską vietoje vien atminties cache.
- [ ] Pridėti Android/iOS native geolocation, filesystem ir share pluginus per Capacitor.
- [ ] Pridėti CI workflow: `npm run check`, `npm run build`, `npm test`.
- [ ] Pridėti jūrinius saugumo sluoksnius: uostai, švyturiai, AIS ar bent statiniai navigaciniai objektai.

