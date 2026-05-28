# TODO

## Atlikta

- [x] Pridėti LT/EN kalbos perjungimą, Day/Night temą ir sutvarkyti dinaminius UI tekstus.
- [x] Sutvarkyti mygtukų būsenas, GPS start/stop, waypoint režimą ir clear route veikimą.
- [x] Sumažinti valdiklius, padidinti žemėlapio plotą ir pašalinti nereikalingus tekstus po žemėlapiu.
- [x] Pridėti maršruto taškų sąrašą, taškų trynimą, GPX importą/eksportą ir maršrutų istoriją.
- [x] Pridėti MOB/SOS, GPS greitį/kryptį, matavimo režimą ir minimalaus saugaus gylio įspėjimą.
- [x] Sutvarkyti realius EMODnet gylius, GEBCO dugno reljefą, gylių legendą ir sluoksnių valdiklį.
- [x] Pridėti PWA `manifest.json`, app ikonėles, install mygtuką, service worker, offline statusą ir cache išvalymą.
- [x] Perkelti Leaflet ir `leaflet-rotate` į lokalius `vendor/` failus.
- [x] Pridėti Vite dev/build sistemą ir pašalinti klasikinių script warningų priežastį.
- [x] Suskaidyti seną `app.js` į ES modulius: `map`, `gps`, `routes`, `offline`, `pwa`, `i18n`, `ui`, `config`.
- [x] Perkelti aktyvų app entry į `src/main.js`; `app.js` paliktas tik kaip migracijos nuoroda.
- [x] Sukurti offline zonos atsisiuntimą pagal žemėlapio plotą ir zoom lygius.
- [x] Pridėti offline zonos dydžio skaičiavimą, progresą, cancel mygtuką ir storage/cache kvotos rodymą.
- [x] Sukurti Node EMODnet/GEBCO proxy su CORS, whitelist, saugumo headeriais ir diskiniu `.proxy-cache/`.
- [x] Pridėti Capacitor Android/iOS projektus.
- [x] Pridėti Capacitor native pluginus: Geolocation, Filesystem, Share.
- [x] Pridėti Android lokacijos/interneto teises ir iOS lokacijos aprašymus.
- [x] Pridėti Playwright testus pagrindinėms desktop ir mobile eigoms.
- [x] Pridėti GitHub Actions CI su `npm run check`, `npm run build`, `npm test`.
- [x] Atnaujinti README lietuviškai ir angliškai.
- [x] Sutvarkyti Live Server konfliktą: CSS perkeltas iš JS importų į `index.html`, kad appas nekristų be Vite transformacijos.
- [x] Pakelta service worker cache versija į `v2`, kad senas sugedęs cache nebebūtų naudojamas.

## Patikrinimai

- [x] `npm run check`
- [x] `npm run build`
- [x] `npx cap sync`
- [x] `npm test`

## Tolimesnė modernizacija iki pilnaverčio appo

- [ ] Pakeisti rankinį PWA service worker į `vite-plugin-pwa` arba Workbox su automatiniu hashed build failų precache.
- [ ] Pridėti offline atsisiuntimų manifestą: zonos pavadinimas, ribos, zoom lygiai, dydis, data ir trynimas per UI.
- [ ] Įdiegti cache pruning/LRU strategiją, kad offline plytelės neperžengtų vartotojo pasirinktos ribos.
- [ ] Perkelti proxy cache į SQLite su TTL, dydžio limitais ir administraciniu valymo endpointu.
- [ ] Produkcijai pakeisti proxy CORS `*` į domenų allowlist per env konfigūraciją.
- [ ] Pridėti provider health indikatorių, kad vartotojas matytų EMODnet/GEBCO/OpenStreetMap būseną.
- [ ] Pridėti žemėlapio šaltinių attribution ir naudojimo taisyklių auditą kiekvienam provider’iui.
- [ ] Pridėti jūrinius saugumo sluoksnius: uostai, švyturiai, navigaciniai ženklai, draudžiamos zonos.
- [ ] Sukurti maršruto redagavimą: taškų perrikiavimas, pervadinimas, pastabos ir atskirų maršrutų biblioteka.
- [ ] Pridėti native background geolocation su aiškiu privatumo nustatymu ir baterijos taupymo režimu.
- [ ] Pridėti Android release signing, bundle generavimą ir automatinį versijų numeravimą.
- [ ] iOS release etapui naudoti macOS + Xcode, sukonfigūruoti signing, capabilities ir App Store metaduomenis.
- [ ] Pridėti Lighthouse/PWA auditą į CI.
- [ ] Pridėti klaidų diagnostiką: lokalių logų eksportą, proxy klaidų ataskaitas ir optional crash/error reporting.
- [ ] Pridėti e2e testus offline download cancel, GPX import/export ir Capacitor build sanity patikrinimams.
