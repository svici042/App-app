/*
    App logic / Programos logika
    LT: čia vykdomi navigacijos žemėlapio sluoksniai, GPS vietos nustatymas, maršrutų planavimas ir offline funkcijos.
    EN: map layers, location updates, route planning, and offline download simulation are handled here.
*/

// LT: Saugo vartotojo GPS žymeklį, tikslumo apskritimą ir judėjimo istoriją. / EN: Stores the user's GPS marker, accuracy circle, and movement history.
const currentPosition = {
  marker: null,
  accuracyCircle: null,
  track: null,
  positions: [],
};

// LT: Saugo rankiniu būdu sudėtus maršruto taškus ir juos jungiančią liniją. / EN: Stores manually added route waypoints and the line connecting them.
const routeState = {
  markers: [],
  line: null,
};

let waypointMode = false;
let layerControl = null;
let gpsWatchId = null;

// LT: Kalba ir tema išsaugomos naršyklėje, kad perkrovus puslapį pasirinkimai liktų. / EN: Language and theme are saved in the browser so choices remain after reload.
let lang = "lt";
let theme = "dark";
if (typeof window !== "undefined" && window.localStorage) {
  lang = window.localStorage.getItem("marine-navigator-lang") || "lt";
  theme = window.localStorage.getItem("marine-navigator-theme") || "dark";
}

theme = theme === "light" ? "light" : "dark";
if (typeof document !== "undefined") {
  document.documentElement.dataset.theme = theme;
  document.documentElement.lang = lang;
}

// LT: Visi matomi UI tekstai laikomi vienoje vietoje, kad kalbos keitimas būtų paprastas. / EN: All visible UI strings are kept in one place to make language switching simple.
const TEXT = {
  lt: {
    appDescription:
      "Interaktyvi navigacijos programa jūrai su GPS, gylių, sonaro ir maršrutų planavimo funkcijomis.",
    languageButton: "EN",
    themeLight: "Diena",
    themeDark: "Naktis",
    navNavigation: "Navigacija",
    navCharts: "Žemėlapiai",
    navSettings: "Nustatymai",
    navOffline: "Offline",
    baseDefault: "Pagrindinis",
    baseSatellite: "Satelitas",
    baseTerrain: "Reljefas",
    overlayDepths: "Gyliai",
    overlayContours: "Gylio kontūrai",
    overlaySonar: "Matavimų šaltiniai",
    overlayRelief: "3D dugno reljefas",
    closeMenu: "Uždaryti",
    gpsTitle: "Realaus laiko GPS",
    gpsStart: "Paleisti GPS",
    gpsAlreadyActive: "GPS jau paleistas.",
    addWaypoint: "Pridėti maršruto tašką",
    clearRoute: "Išvalyti maršrutą",
    gpsUnavailable: "GPS nepasiekiamas",
    gpsStatusWaiting: "Laukiama GPS duomenų...",
    gpsStatusActive: (lat, lng) =>
      `GPS veikia: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    gpsStatusError: (msg) => `GPS klaida: ${msg}`,
    routeDistanceTitle: "Maršruto atstumas",
    routeEmpty: "Maršrutas tuščias",
    routeDistance: (km) => `Maršrutas: ${km.toFixed(2)} km`,
    waypointModeHint:
      "Spustelėkite žemėlapį, kad pridėtumėte maršruto tašką.",
    chartsTitle: "Žemėlapio sluoksniai",
    chartsDescription:
      "Matomi realūs EMODnet gyliai, gylio kontūrai, matavimų šaltiniai ir GEBCO dugno reljefas.",
    depthsTitle: "Gyliai",
    depthsDescription:
      "Gyliai kraunami iš EMODnet Bathymetry WMS ir REST servisų.",
    boatSettingsTitle: "Laivo nustatymai",
    boatLengthLabel: "Laivo ilgis (m)",
    boatSpeedLabel: "Greitis (kn)",
    boatConsumptionLabel: "Kuro sąnaudos (l/h)",
    distanceUnitLabel: "Išmatavimų vienetai",
    estimatesTitle: "Sąmatos",
    boatSummary: (length, speed, consumption) =>
      `Laivo ilgis: ${length} m, greitis: ${speed} kn, sąnaudos: ${consumption} l/val.`,
    boatRange: (range, unit) =>
      `Numatoma rida: ${range} ${unit} su 1000 l kuro.`,
    offlineTitle: "Offline funkcijos",
    offlineDescription:
      "Išsaugokite pasirinktą sritį naudodami vietinę saugyklą.",
    downloadOffline: "Parsisiųsti zoną",
    loadOffline: "Įkelti offline",
    offlineStatusTitle: "Statusas",
    offlineWaiting: "Laukia",
    offlineSaved: "Offline zona išsaugota.",
    offlineLoaded: "Offline zona įkelta.",
    offlineNoData: "Nėra išsaugotų offline duomenų.",
    marineChartTitle: "Jūrinis žemėlapis",
    marineChartDescription:
      "Pagrindinis žemėlapis rodo realius batimetrijos sluoksnius, maršrutus ir realią vietą.",
    terrainTitle: "3D dugno reljefas",
    terrainDescription:
      "GEBCO shaded relief sluoksnis paryškina tikrą dugno reljefą.",
    footer:
      "Palieskite žemėlapį, kad pridėtumėte maršruto tašką.",
    depthPopup: (depth) => `Realus EMODnet gylis: ${depth} m`,
    depthPopupError: "Nepavyko gauti gylio šiame taške.",
    depthPopupLoading: "Gaunamas realus gylis...",
    depthPopupNoData: "Šiame taške gylio duomenų nėra.",
    waypointPopup: "Maršruto taškas",
    locationPopup: "Jūsų vieta",
  },
  en: {
    appDescription:
      "Interactive marine navigation app with GPS, depth, sonar, and route planning tools.",
    languageButton: "LT",
    themeLight: "Day",
    themeDark: "Night",
    navNavigation: "Navigation",
    navCharts: "Charts",
    navSettings: "Settings",
    navOffline: "Offline",
    baseDefault: "Default",
    baseSatellite: "Satellite",
    baseTerrain: "Terrain",
    overlayDepths: "Depths",
    overlayContours: "Depth contours",
    overlaySonar: "Survey sources",
    overlayRelief: "3D seabed relief",
    closeMenu: "Close",
    gpsTitle: "Real-time GPS",
    gpsStart: "Start GPS",
    gpsAlreadyActive: "GPS is already active.",
    addWaypoint: "Add waypoint",
    clearRoute: "Clear route",
    gpsUnavailable: "GPS unavailable",
    gpsStatusWaiting: "Waiting for GPS...",
    gpsStatusActive: (lat, lng) =>
      `GPS active: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    gpsStatusError: (msg) => `GPS error: ${msg}`,
    routeDistanceTitle: "Route distance",
    routeEmpty: "Route empty",
    routeDistance: (km) => `Route distance: ${km.toFixed(2)} km`,
    waypointModeHint: "Click the map to add waypoint.",
    chartsTitle: "Map layers",
    chartsDescription:
      "Real EMODnet depths, depth contours, survey sources, and GEBCO seabed relief are visible on the map.",
    depthsTitle: "Depths",
    depthsDescription:
      "Depths are loaded from EMODnet Bathymetry WMS and REST services.",
    boatSettingsTitle: "Boat settings",
    boatLengthLabel: "Boat length (m)",
    boatSpeedLabel: "Speed (kn)",
    boatConsumptionLabel: "Fuel use (l/h)",
    distanceUnitLabel: "Distance units",
    estimatesTitle: "Estimates",
    boatSummary: (length, speed, consumption) =>
      `Boat length: ${length} m, speed: ${speed} kn, fuel use: ${consumption} l/h.`,
    boatRange: (range, unit) =>
      `Estimated range: ${range} ${unit} with 1000 l of fuel.`,
    offlineTitle: "Offline functions",
    offlineDescription: "Save selected area for offline use.",
    downloadOffline: "Download area",
    loadOffline: "Load offline",
    offlineStatusTitle: "Status",
    offlineWaiting: "Waiting",
    offlineSaved: "Offline area saved.",
    offlineLoaded: "Offline area loaded.",
    offlineNoData: "No offline data found.",
    marineChartTitle: "Marine chart",
    marineChartDescription:
      "The main chart shows real bathymetry layers, routes, and live position.",
    terrainTitle: "3D seabed relief",
    terrainDescription:
      "The GEBCO shaded relief layer highlights real seabed terrain.",
    footer: "Tap the map to add route waypoints.",
    depthPopup: (depth) => `Real EMODnet depth: ${depth} m`,
    depthPopupError: "Could not retrieve depth for this point.",
    depthPopupLoading: "Loading real depth...",
    depthPopupNoData: "No depth data at this point.",
    waypointPopup: "Route waypoint",
    locationPopup: "Your location",
  },
};

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

// LT: Atnaujina temos atributą ant <html> ir pakeičia temos mygtuko tekstą. / EN: Updates the theme attribute on <html> and changes the theme button text.
function renderTheme() {
  document.documentElement.dataset.theme = theme;
  setText("theme-toggle", theme === "dark" ? TEXT[lang].themeLight : TEXT[lang].themeDark);
}

// LT: Perrašo visus matomus tekstus pagal pasirinktą kalbą. / EN: Rewrites all visible text based on the selected language.
function renderAllTexts() {
  const t = TEXT[lang];
  const navButtons = document.querySelectorAll(".nav-tabs button");

  setText("app-description", t.appDescription);
  setText("lang-toggle", t.languageButton);
  setText("gps-title", t.gpsTitle);
  setText("gps-start", t.gpsStart);
  setText("waypoint-mode-btn", t.addWaypoint);
  setText("clear-route", t.clearRoute);
  setText("route-distance-title", t.routeDistanceTitle);
  setText("charts-title", t.chartsTitle);
  setText("charts-description", t.chartsDescription);
  setText("depths-title", t.depthsTitle);
  setText("depths-description", t.depthsDescription);
  setText("boat-settings-title", t.boatSettingsTitle);
  setText("boat-length-label", t.boatLengthLabel);
  setText("boat-speed-label", t.boatSpeedLabel);
  setText("boat-consumption-label", t.boatConsumptionLabel);
  setText("distance-unit-label", t.distanceUnitLabel);
  setText("estimates-title", t.estimatesTitle);
  setText("offline-title", t.offlineTitle);
  setText("offline-description", t.offlineDescription);
  setText("download-offline", t.downloadOffline);
  setText("load-offline", t.loadOffline);
  setText("offline-status-title", t.offlineStatusTitle);
  setText("marine-chart-title", t.marineChartTitle);
  setText("marine-chart-description", t.marineChartDescription);
  setText("terrain-title", t.terrainTitle);
  setText("terrain-description", t.terrainDescription);
  setText("map-footer", t.footer);
  setText("close-menu", "×");
  document.getElementById("close-menu")?.setAttribute("aria-label", t.closeMenu);

  if (navButtons[0]) navButtons[0].textContent = t.navNavigation;
  if (navButtons[1]) navButtons[1].textContent = t.navCharts;
  if (navButtons[2]) navButtons[2].textContent = t.navSettings;
  if (navButtons[3]) navButtons[3].textContent = t.navOffline;

  renderTheme();
  renderBoatPreview();

  const gpsStatus = document.getElementById("gps-status");
  if (gpsStatus) {
    gpsStatus.textContent = currentPosition.positions.length
      ? gpsStatus.textContent
      : t.gpsStatusWaiting;
  }

  const routeDistance = document.getElementById("route-distance");
  if (routeDistance && routeState.markers.length === 0)
    routeDistance.textContent = t.routeEmpty;
}

const boatSettings = {
  length: 12,
  speed: 18,
  consumption: 35,
  units: "metric",
};

// LT: Pagrindinis Leaflet žemėlapis. Centras nustatytas ties Lietuvos pajūriu. / EN: Main Leaflet map centered near the Lithuanian coast.
const map = L.map("map", {
  center: [55.7, 21.1],
  zoom: 7,
  zoomControl: false,
});

// LT: Atskiri pane sluoksniai užtikrina, kad reljefas, gyliai ir sonaras būtų matomi virš bazinio žemėlapio. / EN: Separate panes ensure relief, depths, and sonar stay visible above the base map.
map.createPane("reliefPane");
map.createPane("depthPane");
map.createPane("contourPane");
map.createPane("sonarPane");
map.getPane("reliefPane").style.zIndex = 430;
map.getPane("depthPane").style.zIndex = 440;
map.getPane("contourPane").style.zIndex = 450;
map.getPane("sonarPane").style.zIndex = 460;

// LT: Baziniai žemėlapio sluoksniai, kuriuos galima pasirinkti dešinėje valdiklyje. / EN: Base map layers selectable from the control on the right.
const baseLayers = {
  Default: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
  }),
  Satelitas: L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "© Esri",
    },
  ),
  Terra: L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "© Esri",
    },
  ),
};

// LT: Realūs batimetrijos sluoksniai iš EMODnet ir GEBCO WMS servisų. / EN: Real bathymetry layers from EMODnet and GEBCO WMS services.
const depthLayer = L.tileLayer.wms("https://ows.emodnet-bathymetry.eu/wms", {
  layers: "mean_multicolour",
  format: "image/png",
  transparent: true,
  pane: "depthPane",
  opacity: 0.72,
  attribution: "EMODnet Bathymetry",
});
const contourLayer = L.tileLayer.wms("https://ows.emodnet-bathymetry.eu/wms", {
  layers: "contours",
  format: "image/png",
  transparent: true,
  pane: "contourPane",
  opacity: 0.95,
  attribution: "EMODnet Bathymetry",
});
const sonarLayer = L.tileLayer.wms("https://ows.emodnet-bathymetry.eu/wms", {
  layers: "source_references",
  format: "image/png",
  transparent: true,
  pane: "sonarPane",
  opacity: 0.72,
  attribution: "EMODnet Bathymetry",
});
const reliefLayer = L.tileLayer.wms("https://wms.gebco.net/mapserv", {
  layers: "GEBCO_Latest",
  format: "image/png",
  transparent: true,
  pane: "reliefPane",
  opacity: 0.58,
  attribution: "GEBCO",
});
const trackLayer = L.layerGroup().addTo(map);

baseLayers.Default.addTo(map);
reliefLayer.addTo(map);
depthLayer.addTo(map);
contourLayer.addTo(map);
sonarLayer.addTo(map);

// LT: Perkuria Leaflet sluoksnių valdiklį, kad jo pavadinimai pasikeistų keičiant kalbą. / EN: Rebuilds the Leaflet layer control so labels update when the language changes.
function renderLayerControl() {
  const t = TEXT[lang] || TEXT.lt;

  if (layerControl) {
    map.removeControl(layerControl);
  }

  layerControl = L.control
    .layers(
      {
        [t.baseDefault]: baseLayers.Default,
        [t.baseSatellite]: baseLayers.Satelitas,
        [t.baseTerrain]: baseLayers.Terra,
      },
      {
        [t.overlayDepths]: depthLayer,
        [t.overlayContours]: contourLayer,
        [t.overlaySonar]: sonarLayer,
        [t.overlayRelief]: reliefLayer,
      },
      { collapsed: false, position: "topright" },
    )
    .addTo(map);
}

L.control.zoom({ position: "bottomright" }).addTo(map);

// LT: Užklausia tikrą EMODnet gylį pasirinktame taške. / EN: Requests a real EMODnet depth sample at the selected point.
async function fetchDepthSample(latlng) {
  const geom = `POINT(${latlng.lng} ${latlng.lat})`;
  const url = `https://rest.emodnet-bathymetry.eu/depth_sample?geom=${encodeURIComponent(geom)}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Depth request failed: ${response.status}`);
  }

  return response.json();
}

// LT: Parodo realų gylį paspaustame žemėlapio taške. / EN: Shows the real depth at the clicked map point.
async function showDepthAtPoint(event) {
  const t = TEXT[lang] || TEXT.lt;
  const popup = L.popup()
    .setLatLng(event.latlng)
    .setContent(t.depthPopupLoading)
    .openOn(map);

  try {
    const sample = await fetchDepthSample(event.latlng);
    const depth = sample?.smoothed ?? sample?.avg ?? sample?.min ?? null;
    popup.setContent(
      typeof depth === "number" ? t.depthPopup(depth.toFixed(1)) : t.depthPopupNoData,
    );
  } catch (error) {
    popup.setContent(t.depthPopupError);
  }
}

// LT: Atnaujina GPS žymeklį žemėlapyje ir nubrėžia vartotojo judėjimo taką. / EN: Updates the GPS marker on the map and draws the user's movement track.
function updatePositionMarker(lat, lng, accuracy) {
  if (!currentPosition.marker) {
    currentPosition.marker = L.circleMarker([lat, lng], {
      radius: 12,
      fillColor: "#2dd4a5",
      color: "#d9f99d",
      weight: 2,
      fillOpacity: 0.9,
    })
      .addTo(map)
      .bindPopup(TEXT[lang].locationPopup);
    currentPosition.accuracyCircle = L.circle([lat, lng], {
      radius: accuracy,
      color: "#35b3ff",
      fillColor: "#35b3ff",
      fillOpacity: 0.08,
    }).addTo(map);
  } else {
    currentPosition.marker.setLatLng([lat, lng]);
    currentPosition.accuracyCircle.setLatLng([lat, lng]).setRadius(accuracy);
  }

  currentPosition.positions.push([lat, lng]);
  if (currentPosition.positions.length > 1) {
    if (currentPosition.track) {
      trackLayer.removeLayer(currentPosition.track);
    }
    currentPosition.track = L.polyline(currentPosition.positions, {
      color: "#35b3ff",
      weight: 4,
      dashArray: "12,8",
    }).addTo(trackLayer);
  }

  map.panTo([lat, lng], { animate: true, duration: 1.1 });
  document.getElementById("gps-status").textContent =
    TEXT[lang].gpsStatusActive(lat, lng);
}

// LT: Parodo instrukciją, kai vartotojas įjungia maršruto taško pridėjimo režimą. / EN: Shows instructions when waypoint placement mode is enabled.
function updateWaypointModeUI(isOn) {
  const t = TEXT[lang] || TEXT.lt;
  const gpsStatus = document.getElementById("gps-status");
  if (!gpsStatus) return;

  if (isOn) {
    gpsStatus.textContent = t.waypointModeHint;
  } else {
    gpsStatus.textContent = t.gpsStatusWaiting;
  }
}

// LT: Paleidžia naršyklės geolokaciją ir perduoda gautas koordinates žemėlapiui. / EN: Starts browser geolocation and passes received coordinates to the map.
function geolocate() {
  if (gpsWatchId !== null) {
    document.getElementById("gps-status").textContent = TEXT[lang].gpsAlreadyActive;
    return;
  }

  if (!navigator.geolocation) {
    document.getElementById("gps-status").textContent = TEXT[lang].gpsUnavailable;
    return;
  }

  gpsWatchId = navigator.geolocation.watchPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const accuracy = position.coords.accuracy;
      updatePositionMarker(lat, lng, accuracy);
    },
    (error) => {
      document.getElementById("gps-status").textContent =
        TEXT[lang].gpsStatusError(error.message);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 10000,
    },
  );
}

// LT: Perskaito laivo nustatymus iš formos laukų ir atnaujina santrauką. / EN: Reads boat settings from form fields and updates the summary.
function setBoatSettingsFromUI() {
  boatSettings.length = Number(document.getElementById("boat-length").value);
  boatSettings.speed = Number(document.getElementById("boat-speed").value);
  boatSettings.consumption = Number(
    document.getElementById("boat-consumption").value,
  );
  boatSettings.units = document.getElementById("distance-unit").value;
  renderBoatPreview();
}

// LT: Parodo apytikslę ridą pagal greitį, kuro sąnaudas ir pasirinktus vienetus. / EN: Shows estimated range based on speed, fuel use, and selected units.
function renderBoatPreview() {
  const t = TEXT[lang] || TEXT.lt;
  const speed = boatSettings.speed;
  const consumption = boatSettings.consumption;
  const range = ((1000 / consumption) * speed).toFixed(1);
  const labelUnit = boatSettings.units === "metric" ? "km" : "mi";
  document.getElementById("boat-summary").textContent =
    t.boatSummary(boatSettings.length, speed, consumption);
  document.getElementById("boat-range").textContent =
    t.boatRange(range, labelUnit);
}

// LT: Haversine formulė skaičiuoja atstumą tarp dviejų koordinačių kilometrais. / EN: The Haversine formula calculates distance between two coordinates in kilometers.
function distanceBetweenCoords(lat1, lng1, lat2, lng2) {
  const toRad = (angle) => (angle * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// LT: Prideda naują tempiamą maršruto tašką paspaustoje žemėlapio vietoje. / EN: Adds a new draggable route waypoint at the clicked map location.
function addRoutePoint(event) {
  const position = event.latlng;
  const marker = L.marker(position, {
    draggable: true,
  }).addTo(map);

  marker.bindPopup(TEXT[lang].waypointPopup).openPopup();
  routeState.markers.push(marker);
  marker.on("dragend", refreshRoute);
  refreshRoute();
}

// LT: Perbraižo maršruto liniją ir perskaičiuoja bendrą maršruto ilgį. / EN: Redraws the route line and recalculates total route distance.
function refreshRoute() {
  const positions = routeState.markers.map((marker) => marker.getLatLng());
  if (routeState.line) {
    map.removeLayer(routeState.line);
  }
  routeState.line = L.polyline(positions, {
    color: "#ffab00",
    weight: 5,
    opacity: 0.8,
  }).addTo(map);

  if (positions.length >= 2) {
    let total = 0;
    for (let i = 0; i < positions.length - 1; i++) {
      total += distanceBetweenCoords(
        positions[i].lat,
        positions[i].lng,
        positions[i + 1].lat,
        positions[i + 1].lng,
      );
    }
    document.getElementById("route-distance").textContent =
      TEXT[lang].routeDistance(total);
  } else {
    document.getElementById("route-distance").textContent = TEXT[lang].routeEmpty;
  }
}

// LT: Pašalina visus maršruto taškus ir liniją iš žemėlapio. / EN: Removes all route waypoints and the route line from the map.
function clearRoute() {
  routeState.markers.forEach((marker) => map.removeLayer(marker));
  routeState.markers = [];
  if (routeState.line) {
    map.removeLayer(routeState.line);
    routeState.line = null;
  }
  document.getElementById("route-distance").textContent = TEXT[lang].routeEmpty;
}

// LT: Išsaugo dabartinį žemėlapio centrą, mastelį ir ribas localStorage saugykloje. / EN: Saves the current map center, zoom, and bounds in localStorage.
function downloadOfflineArea() {
  const bounds = map.getBounds();
  const offlineData = {
    center: map.getCenter(),
    zoom: map.getZoom(),
    timestamp: Date.now(),
    bounds: bounds.toBBoxString(),
    notes:
      "Offline area saved for navigation / Išsaugota offline zona navigacijai",
  };
  localStorage.setItem("marine-navigator-offline", JSON.stringify(offlineData));
  document.getElementById("offline-status").textContent = TEXT[lang].offlineSaved;
}

// LT: Atkuria anksčiau išsaugotą offline zoną, jei tokia yra. / EN: Restores the previously saved offline area when one exists.
function loadOfflineArea() {
  const offlineData = localStorage.getItem("marine-navigator-offline");
  if (!offlineData) {
    document.getElementById("offline-status").textContent =
      TEXT[lang].offlineNoData;
    return;
  }
  const data = JSON.parse(offlineData);
  map.setView([data.center.lat, data.center.lng], data.zoom);
  document.getElementById("offline-status").textContent = TEXT[lang].offlineLoaded;
}

// LT: Atidaro pasirinktą meniu panelį modaliniame lange virš žemėlapio. / EN: Opens the selected menu panel in a modal window above the map.
function activateTab(tabName) {
  const t = TEXT[lang] || TEXT.lt;
  const menuWindow = document.getElementById("menu-window");
  const menuTitle = document.getElementById("menu-title");

  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("hidden", panel.id !== tabName);
  });
  document.querySelectorAll(".nav-tabs button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });

  if (menuTitle) {
    const titles = {
      "tab-navigation": t.navNavigation,
      "tab-charts": t.navCharts,
      "tab-settings": t.navSettings,
      "tab-offline": t.navOffline,
    };
    menuTitle.textContent = titles[tabName] || t.navNavigation;
  }

  if (menuWindow) {
    menuWindow.classList.remove("hidden");
    menuWindow.setAttribute("aria-hidden", "false");
  }
}

// LT: Uždaro modalinį meniu ir nuima aktyvų meniu mygtuko pažymėjimą. / EN: Closes the modal menu and clears the active menu button state.
function closeMenu() {
  const menuWindow = document.getElementById("menu-window");
  if (!menuWindow) return;

  menuWindow.classList.add("hidden");
  menuWindow.setAttribute("aria-hidden", "true");
  document.querySelectorAll(".nav-tabs button").forEach((btn) => {
    btn.classList.remove("active");
  });
}

// LT: Vienoje vietoje prijungia visus mygtukus, formų laukus ir klaviatūros veiksmus. / EN: Wires all buttons, form fields, and keyboard actions in one place.
function setupUI() {
  document
    .getElementById("boat-length")
    .addEventListener("input", setBoatSettingsFromUI);
  document
    .getElementById("boat-speed")
    .addEventListener("input", setBoatSettingsFromUI);
  document
    .getElementById("boat-consumption")
    .addEventListener("input", setBoatSettingsFromUI);
  document
    .getElementById("distance-unit")
    .addEventListener("change", setBoatSettingsFromUI);

  document.getElementById("clear-route").addEventListener("click", clearRoute);
  document
    .getElementById("download-offline")
    .addEventListener("click", downloadOfflineArea);
  document
    .getElementById("load-offline")
    .addEventListener("click", loadOfflineArea);

  document.querySelectorAll(".nav-tabs button").forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.tab));
  });

  document.getElementById("close-menu").addEventListener("click", closeMenu);
  document.getElementById("menu-window").addEventListener("click", (event) => {
    if (event.target.id === "menu-window") closeMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  // LT: Mygtukai jungiami pagal ID, kad nebūtų supainioti su kitais tokios pačios klasės mygtukais. / EN: Buttons are wired by ID so they are not confused with other buttons using the same class.
  const gpsStartBtn = document.getElementById("gps-start");
  if (gpsStartBtn) gpsStartBtn.addEventListener("click", geolocate);

  const waypointBtn = document.getElementById("waypoint-mode-btn");
  if (waypointBtn) {
    waypointBtn.addEventListener("click", () => {
      waypointMode = true;
      updateWaypointModeUI(true);
    });
  }

  map.on("click", (e) => {
    if (waypointMode) {
      waypointMode = false;
      updateWaypointModeUI(false);
      addRoutePoint(e);
      return;
    }

    showDepthAtPoint(e);
  });

  // LT: Kalbos ir temos perjungimo mygtukai. / EN: Language and theme toggle buttons.
  const langToggle = document.getElementById("lang-toggle");
  if (langToggle) {
    langToggle.addEventListener("click", () => {
      lang = lang === "lt" ? "en" : "lt";
      localStorage.setItem("marine-navigator-lang", lang);
      document.documentElement.lang = lang;
      renderAllTexts();
      renderLayerControl();
      if (routeState.markers.length) {
        refreshRoute();
      }
    });
  }

  const themeToggle = document.getElementById("theme-toggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      theme = theme === "dark" ? "light" : "dark";
      localStorage.setItem("marine-navigator-theme", theme);
      renderTheme();
    });
  }

  renderAllTexts();
  setBoatSettingsFromUI();
}

function init() {
  renderLayerControl();
  setupUI();
  document.getElementById("gps-status").textContent = TEXT[lang].gpsStatusWaiting;
}

window.addEventListener("load", init);
