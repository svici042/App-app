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
    overlaySonar: "Sonaras",
    overlayRelief: "3D dugno reljefas",
    closeMenu: "Uždaryti",
    gpsTitle: "Realaus laiko GPS",
    gpsStart: "Paleisti GPS",
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
      "Matomi gyliai, sonaro zona ir šešėliuotas dugno reljefas.",
    depthsTitle: "Gyliai",
    depthsDescription:
      "Mėlyni taškai ir kontūrai rodo apytikrius gylio matavimus.",
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
      "Pagrindinis žemėlapis rodo gylius, sonaro zoną, dugno reljefą, maršrutus ir realią vietą.",
    terrainTitle: "3D dugno reljefas",
    terrainDescription:
      "Šešėliuotas reljefo sluoksnis paryškina dugno formas ir gylio kontūrus.",
    footer:
      "Palieskite žemėlapį, kad pridėtumėte maršruto tašką.",
    depthPopup: (depth) => `Gylis: ${depth} m`,
    sonarPopup: "Sonaro skenavimo zona",
    reliefPopup: "3D dugno reljefo zona",
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
    overlaySonar: "Sonar",
    overlayRelief: "3D seabed relief",
    closeMenu: "Close",
    gpsTitle: "Real-time GPS",
    gpsStart: "Start GPS",
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
      "Depths, sonar zone, and shaded seabed relief are visible on the map.",
    depthsTitle: "Depths",
    depthsDescription:
      "Blue markers and contour lines show approximate depth readings.",
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
      "The main chart shows depths, sonar area, seabed relief, routes, and live position.",
    terrainTitle: "3D seabed relief",
    terrainDescription:
      "The shaded relief layer highlights seabed forms and depth contours.",
    footer: "Tap the map to add route waypoints.",
    depthPopup: (depth) => `Depth: ${depth} m`,
    sonarPopup: "Sonar scanning zone",
    reliefPopup: "3D seabed relief area",
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
    "https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg",
    {
      attribution: "Map tiles by Stamen Design",
    },
  ),
};

// LT: Atskiri sluoksniai leidžia įjungti/išjungti gylius, sonarą ir dugno reljefą. / EN: Separate layers allow depths, sonar, and seabed relief to be toggled on or off.
const sonarLayer = L.layerGroup();
const depthLayer = L.layerGroup();
const reliefLayer = L.layerGroup();
const trackLayer = L.layerGroup().addTo(map);

baseLayers.Default.addTo(map);
reliefLayer.addTo(map);
depthLayer.addTo(map);
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
        [t.overlaySonar]: sonarLayer,
        [t.overlayRelief]: reliefLayer,
      },
      { collapsed: false, position: "topright" },
    )
    .addTo(map);
}

L.control.zoom({ position: "bottomright" }).addTo(map);

// LT: Sukuria matomus gylių taškus, gylio etiketes ir kontūrų linijas. / EN: Creates visible depth points, depth labels, and contour lines.
function createDepthMarkers() {
  const points = [
    { lat: 55.88, lng: 20.78, depth: 18 },
    { lat: 55.83, lng: 21.22, depth: 29 },
    { lat: 55.7, lng: 21.42, depth: 36 },
    { lat: 55.63, lng: 21.0, depth: 51 },
    { lat: 55.52, lng: 21.24, depth: 63 },
    { lat: 55.46, lng: 20.9, depth: 72 },
    { lat: 55.9, lng: 21.5, depth: 18 },
  ];

  points.forEach((point) => {
    L.circleMarker([point.lat, point.lng], {
      radius: 12,
      fillColor: "#3dd4ff",
      color: "#0bc8ff",
      weight: 2,
      opacity: 0.95,
      fillOpacity: 0.72,
    })
      .bindPopup(TEXT[lang].depthPopup(point.depth))
      .addTo(depthLayer);

    L.marker([point.lat, point.lng], {
      icon: L.divIcon({
        className: "depth-label",
        html: `${point.depth} m`,
        iconSize: [48, 24],
        iconAnchor: [24, 12],
      }),
      interactive: false,
    }).addTo(depthLayer);
  });

  // LT: Kontūrų linijos imituoja gylio žemėlapio izobatas. / EN: Contour lines simulate depth-chart isobaths.
  [
    [
      [55.95, 20.7],
      [55.85, 21.05],
      [55.78, 21.45],
      [55.68, 21.7],
    ],
    [
      [55.78, 20.58],
      [55.66, 20.95],
      [55.55, 21.28],
      [55.42, 21.52],
    ],
    [
      [55.58, 20.48],
      [55.45, 20.85],
      [55.34, 21.2],
      [55.24, 21.42],
    ],
  ].forEach((line, index) => {
    L.polyline(line, {
      color: ["#8be9ff", "#35b3ff", "#0876c9"][index],
      weight: 2,
      opacity: 0.75,
      dashArray: index === 0 ? "4,8" : undefined,
    }).addTo(depthLayer);
  });
}

// LT: Sukuria sonaro žiedus, spindulį ir centrinę SONAR etiketę. / EN: Creates sonar rings, a sweep line, and the central SONAR label.
function createSonarOverlay() {
  const center = [55.75, 21.1];
  const rings = [9000, 18000, 27000];

  rings.forEach((radius) => {
    L.circle(center, {
      radius,
      color: "#2dd4a5",
      fillColor: "#2dd4a5",
      fillOpacity: radius === rings[rings.length - 1] ? 0.08 : 0.02,
      weight: 2,
      dashArray: "6,10",
    })
      .bindPopup(TEXT[lang].sonarPopup)
      .addTo(sonarLayer);
  });

  // LT: Spindulys parodo sonaro skenavimo kryptį. / EN: The sweep line shows the sonar scan direction.
  [
    [55.75, 21.1],
    [55.98, 21.32],
  ].forEach((_, index, points) => {
    if (index === 0) {
      L.polyline(points, {
        color: "#2dd4a5",
        weight: 4,
        opacity: 0.86,
      }).addTo(sonarLayer);
    }
  });

  L.marker(center, {
    icon: L.divIcon({
      className: "sonar-label",
      html: "SONAR",
      iconSize: [70, 24],
      iconAnchor: [35, 12],
    }),
  }).addTo(sonarLayer);
}

// LT: Sukuria supaprastintą šešėliuotą dugno reljefą iš poligonų ir keterų linijų. / EN: Creates simplified shaded seabed relief from polygons and ridge lines.
function createReliefOverlay() {
  const reliefBands = [
    {
      points: [
        [56.02, 20.55],
        [55.96, 21.72],
        [55.78, 21.86],
        [55.83, 20.48],
      ],
      fill: "#113f67",
      opacity: 0.16,
    },
    {
      points: [
        [55.82, 20.48],
        [55.76, 21.78],
        [55.52, 21.7],
        [55.56, 20.4],
      ],
      fill: "#0b6b88",
      opacity: 0.18,
    },
    {
      points: [
        [55.56, 20.4],
        [55.52, 21.7],
        [55.24, 21.55],
        [55.28, 20.36],
      ],
      fill: "#0891b2",
      opacity: 0.2,
    },
  ];

  reliefBands.forEach((band) => {
    L.polygon(band.points, {
      color: band.fill,
      fillColor: band.fill,
      fillOpacity: band.opacity,
      weight: 1,
      opacity: 0.35,
    })
      .bindPopup(TEXT[lang].reliefPopup)
      .addTo(reliefLayer);
  });

  [
    [
      [55.96, 20.68],
      [55.72, 20.95],
      [55.58, 21.28],
      [55.46, 21.58],
    ],
    [
      [55.88, 20.52],
      [55.62, 20.78],
      [55.42, 21.02],
      [55.28, 21.34],
    ],
  ].forEach((ridge) => {
    L.polyline(ridge, {
      color: "#d9f99d",
      weight: 3,
      opacity: 0.52,
    }).addTo(reliefLayer);
  });
}

// LT: Perpiešia jūrinius sluoksnius, kai reikia atnaujinti popup tekstus ar kalbą. / EN: Redraws marine layers when popup text or language must be refreshed.
function renderMarineLayers() {
  depthLayer.clearLayers();
  sonarLayer.clearLayers();
  reliefLayer.clearLayers();
  createReliefOverlay();
  createDepthMarkers();
  createSonarOverlay();
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
  if (!navigator.geolocation) {
    document.getElementById("gps-status").textContent = TEXT[lang].gpsUnavailable;
    return;
  }

  navigator.geolocation.watchPosition(
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
    if (!waypointMode) return;
    waypointMode = false;
    updateWaypointModeUI(false);
    addRoutePoint(e);
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
      renderMarineLayers();
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
  renderMarineLayers();
  setupUI();
  geolocate();
  document.getElementById("gps-status").textContent = TEXT[lang].gpsStatusWaiting;
}

window.addEventListener("load", init);
