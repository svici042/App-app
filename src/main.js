/**
 * Marine Navigator application controller.
 *
 * Handles Leaflet map initialization, provider layers, GPS tracking, navigation
 * modes, route planning, GPX import/export, offline map caching, depth queries,
 * WMS synchronization, PWA install state, and Capacitor-specific native helpers.
 */

import "../vendor/leaflet/leaflet.js";
import "../vendor/leaflet-rotate/leaflet-rotate-src.js";
import {
  CACHE_NAME,
  DEPTH_SOURCES,
  OFFLINE_AREAS_KEY,
  PROVIDERS,
  ROUTE_HISTORY_KEY,
  PROXY_BASE_URL,
  RUNTIME_CACHE_NAME,
  TILE_SOURCES,
  WMS_SOURCES,
} from "./config.js";
import { TEXT } from "./i18n.js";
import { createMap, createMapPanes } from "./map.js";
import {
  clearNativePositionWatch,
  getNativePosition,
  GPS_WATCH_OPTIONS,
  isNativePlatform,
  metersPerSecondToKnots,
  requestNativeLocationPermission,
  startNativePositionWatch,
} from "./gps.js";
import { setText } from "./ui.js";
import {
  bearingBetweenPoints,
  distanceBetweenCoords,
  readRouteHistory as readRouteHistoryFromStorage,
} from "./routes.js";
import {
  estimateTileCacheSize,
  formatBytes,
  generateOfflineTileUrls,
} from "./offline.js";
import { shareText, writeTextFile } from "./pwa.js";

/**
 * User-position state shared by GPS tracking, follow mode, and heading mode.
 */
const currentPosition = {
  marker: null,
  accuracyCircle: null,
  track: null,
  positions: [],
};

/**
 * Manually planned route state rendered as draggable Leaflet markers and a polyline.
 */
const routeState = {
  markers: [],
  line: null,
};

let waypointMode = false;
let measureMode = false;
let layerControl = null;
let gpsWatchId = null;
let gpsWatchSource = "none";
let gpsShouldRun = false;
let gpsRestarting = false;
let layerErrorShown = false;
let orientationMode = "north";
let deferredInstallPrompt = null;
let mobMarker = null;
let activeBaseLayerKey = "Default";
let offlineAbortController = null;
let lastMenuTrigger = null;
let sidebarCollapsed = false;
let depthPanelCollapsed = true;
let depthLegendCollapsed = true;
let wmsRedrawTimer = null;
let mapGestureActive = false;
let lastMapGestureEndedAt = 0;
let depthQuerySequence = 0;
const mobileLayoutQuery = window.matchMedia?.("(max-width: 1024px)");
const primaryDepthSource = DEPTH_SOURCES.primary;
const fallbackDepthSource = DEPTH_SOURCES.fallback;
const experimental3dSource = DEPTH_SOURCES.experimental3d;
const fallbackDepthStatus = {
  available: Boolean(fallbackDepthSource?.url && fallbackDepthSource?.layers?.relief),
  enabled: false,
};
const depthLayerStatus = {
  loaded: false,
  failed: false,
  requestState: "pending",
  httpStatus: "--",
  lastUrl: "",
};
const contourLayerStatus = {
  loaded: false,
  failed: false,
  requestState: "pending",
  httpStatus: "--",
  lastUrl: "",
};
const gpsDiagnostics = {
  source: "none",
  accuracy: null,
  heading: null,
  headingAccuracy: null,
  lastUpdate: null,
  permission: "unknown",
  batteryProfile: `high accuracy, ${GPS_WATCH_OPTIONS.interval / 1000}s updates`,
};

/**
 * Temporary distance-measurement state kept separate from route planning.
 */
const measureState = {
  markers: [],
  line: null,
};

/**
 * User preferences persisted in localStorage so reloads preserve the UI state.
 */
let lang = "lt";
let theme = "dark";
if (typeof window !== "undefined" && window.localStorage) {
  lang = window.localStorage.getItem("marine-navigator-lang") || "lt";
  theme = window.localStorage.getItem("marine-navigator-theme") || "dark";
  orientationMode =
    window.localStorage.getItem("marine-navigator-orientation") || "north";
}

theme = theme === "light" ? "light" : "dark";
if (orientationMode === "route") orientationMode = "heading";
orientationMode = ["north", "heading", "follow"].includes(orientationMode)
  ? orientationMode
  : "north";
if (typeof document !== "undefined") {
  document.documentElement.dataset.theme = theme;
  document.documentElement.lang = lang;
}

/**
 * Updates the GPS tracking button to reflect active/inactive watch state.
 *
 * @returns {void}
 */
function renderGpsButtonState() {
  const button = document.getElementById("gps-start");
  if (!button) return;

  const isActive = gpsWatchId !== null;
  button.textContent = isActive ? TEXT[lang].gpsButtonActive : TEXT[lang].gpsStart;
  button.classList.toggle("is-active", isActive);
  button.setAttribute("aria-pressed", String(isActive));
}

/**
 * Converts internal GPS diagnostic state into localized UI text.
 *
 * @returns {void}
 */
function renderGpsDiagnostics() {
  const t = TEXT[lang] || TEXT.lt;
  const sourceLabels = {
    none: t.gpsSourceNone,
    browser: t.gpsSourceBrowser,
    native: t.gpsSourceNative,
  };
  const permissionLabels = {
    granted: t.gpsPermissionGranted,
    denied: t.gpsPermissionDenied,
    prompt: t.gpsPermissionPrompt,
    promptWithRationale: t.gpsPermissionPrompt,
    unknown: t.gpsPermissionUnknown,
  };
  const lastUpdate = gpsDiagnostics.lastUpdate
    ? new Intl.DateTimeFormat(lang === "lt" ? "lt-LT" : "en", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date(gpsDiagnostics.lastUpdate))
    : t.gpsLastUpdateUnknown;

  setText(
    "gps-diagnostics",
    t.gpsDiagnostics({
      source: sourceLabels[gpsDiagnostics.source] || gpsDiagnostics.source,
      accuracy: Number.isFinite(gpsDiagnostics.accuracy)
        ? `${Math.round(gpsDiagnostics.accuracy)} m`
        : t.gpsAccuracyUnknown,
      lastUpdate,
      permission:
        permissionLabels[gpsDiagnostics.permission] || gpsDiagnostics.permission,
      batteryProfile: gpsDiagnostics.batteryProfile,
    }),
  );
}

/**
 * Updates the waypoint-mode button used before the next map click adds a route point.
 *
 * @returns {void}
 */
function renderWaypointButtonState() {
  const button = document.getElementById("waypoint-mode-btn");
  if (!button) return;

  button.textContent = waypointMode
    ? TEXT[lang].waypointModeActive
    : TEXT[lang].addWaypoint;
  button.classList.toggle("is-active", waypointMode);
  button.setAttribute("aria-pressed", String(waypointMode));
}

/**
 * Updates the measurement-mode button state.
 *
 * @returns {void}
 */
function renderMeasureButtonState() {
  const button = document.getElementById("measure-mode-btn");
  if (!button) return;

  button.textContent = measureMode ? TEXT[lang].measureActive : TEXT[lang].measureStart;
  button.classList.toggle("is-active", measureMode);
  button.setAttribute("aria-pressed", String(measureMode));
}

/**
 * Renders whether the app can be installed or served through a service worker.
 *
 * @returns {void}
 */
function renderPwaStatus() {
  const status = document.getElementById("pwa-status");
  if (!status) return;

  const hasServiceWorker = "serviceWorker" in navigator;
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone;

  if (isStandalone) {
    status.textContent = TEXT[lang].pwaReady;
  } else if (hasServiceWorker) {
    status.textContent = deferredInstallPrompt
      ? TEXT[lang].pwaReady
      : TEXT[lang].installUnavailable;
  } else {
    status.textContent = TEXT[lang].installUnavailable;
  }
}

/**
 * Applies the current theme to the document and theme toggle.
 *
 * @returns {void}
 */
function renderTheme() {
  document.documentElement.dataset.theme = theme;
  setText("theme-toggle", theme === "dark" ? TEXT[lang].themeLight : TEXT[lang].themeDark);
}

/**
 * Detects whether responsive drawer behavior should be used.
 *
 * @returns {boolean} True for mobile/tablet layout widths.
 */
function isMobileLayout() {
  return Boolean(mobileLayoutQuery?.matches);
}

/**
 * Lets Leaflet recalculate size after animated panel/drawer layout changes.
 *
 * @returns {void}
 */
function invalidateMapAfterLayoutChange() {
  window.setTimeout(() => map.invalidateSize(), 260);
}

/**
 * Collapses or opens the sidebar while preserving focus and mobile drawer state.
 *
 * Mobile behavior is intentionally different: the sidebar becomes a slide-in
 * drawer and an outside backdrop can close it.
 *
 * @param {boolean} collapsed Whether the sidebar should be collapsed.
 * @returns {void}
 */
function setSidebarCollapsed(collapsed) {
  const sidebar = document.getElementById("app-sidebar");
  const openButton = document.getElementById("open-sidebar");
  const collapseButton = document.getElementById("collapse-sidebar");
  const backdrop = document.getElementById("sidebar-backdrop");
  const t = TEXT[lang] || TEXT.lt;

  sidebarCollapsed = collapsed;
  document.body.classList.toggle("sidebar-collapsed", sidebarCollapsed);
  document.body.classList.toggle(
    "sidebar-drawer-open",
    isMobileLayout() && !sidebarCollapsed,
  );

  if (sidebar) {
    const hideFromKeyboard = sidebarCollapsed;
    sidebar.toggleAttribute("inert", hideFromKeyboard);
    sidebar.setAttribute("aria-hidden", String(hideFromKeyboard));
  }

  if (openButton) {
    openButton.setAttribute("aria-label", t.openSidebar);
    openButton.setAttribute("aria-expanded", String(!sidebarCollapsed));
  }

  if (collapseButton) {
    collapseButton.setAttribute(
      "aria-label",
      sidebarCollapsed ? t.expandSidebar : t.collapseSidebar,
    );
    collapseButton.setAttribute("aria-expanded", String(!sidebarCollapsed));
  }

  if (backdrop) {
    backdrop.setAttribute("aria-label", t.closeSidebar);
  }

  if (sidebarCollapsed && sidebar?.contains(document.activeElement)) {
    document.activeElement.blur();
  }

  invalidateMapAfterLayoutChange();
}

/**
 * Opens the responsive sidebar or mobile drawer.
 *
 * @returns {void}
 */
function openSidebar() {
  setSidebarCollapsed(false);
}

/**
 * Closes any modal menu and collapses the sidebar.
 *
 * @returns {void}
 */
function collapseSidebar() {
  closeMenu();
  setSidebarCollapsed(true);
}

/**
 * Applies the correct initial sidebar state for the current viewport width.
 *
 * @returns {void}
 */
function renderResponsiveSidebarState() {
  setSidebarCollapsed(isMobileLayout());
}

/**
 * Collapses the depth diagnostics panel into a compact status chip.
 *
 * @param {boolean} collapsed Whether diagnostics should be collapsed.
 * @returns {void}
 */
function setDepthPanelCollapsed(collapsed) {
  const toggleButton = document.getElementById("toggle-depth-panel");
  const chip = document.getElementById("depth-chip");
  const t = TEXT[lang] || TEXT.lt;

  depthPanelCollapsed = collapsed;
  document.body.classList.toggle("depth-panel-collapsed", depthPanelCollapsed);

  if (toggleButton) {
    toggleButton.textContent = depthPanelCollapsed ? "+" : "−";
    toggleButton.setAttribute(
      "aria-label",
      depthPanelCollapsed ? t.expandDepthStatus : t.collapseDepthStatus,
    );
    toggleButton.setAttribute("aria-expanded", String(!depthPanelCollapsed));
  }

  if (chip) {
    chip.setAttribute(
      "aria-label",
      depthPanelCollapsed ? t.expandDepthStatus : t.collapseDepthStatus,
    );
    chip.setAttribute("aria-expanded", String(!depthPanelCollapsed));
  }
}

/**
 * Toggles the depth diagnostics panel.
 *
 * @returns {void}
 */
function toggleDepthPanel() {
  setDepthPanelCollapsed(!depthPanelCollapsed);
}

/**
 * Collapses or expands the depth legend to keep the map-first layout clear.
 *
 * @param {boolean} collapsed Whether the legend details should be hidden.
 * @returns {void}
 */
function setDepthLegendCollapsed(collapsed) {
  const toggleButton = document.getElementById("toggle-depth-legend");
  const t = TEXT[lang] || TEXT.lt;

  depthLegendCollapsed = collapsed;
  document.body.classList.toggle("depth-legend-collapsed", depthLegendCollapsed);

  if (toggleButton) {
    toggleButton.setAttribute(
      "aria-label",
      depthLegendCollapsed ? t.openDepthLegend : t.closeDepthLegend,
    );
    toggleButton.setAttribute("aria-expanded", String(!depthLegendCollapsed));
  }
}

/**
 * Toggles the compact depth legend.
 *
 * @returns {void}
 */
function toggleDepthLegend() {
  setDepthLegendCollapsed(!depthLegendCollapsed);
}

/**
 * Rewrites visible UI text for the active language and re-renders dependent UI.
 *
 * This is intentionally broad because language changes affect Leaflet controls,
 * panels, status text, and route/offline summaries at the same time.
 *
 * @returns {void}
 */
function renderAllTexts() {
  const t = TEXT[lang];
  const navButtons = document.querySelectorAll(".nav-tabs button");

  setText("app-description", t.appDescription);
  setText("lang-toggle", t.languageButton);
  setText("gps-title", t.gpsTitle);
  setText("gps-stop", t.gpsStop);
  setText("measure-mode-btn", measureMode ? t.measureActive : t.measureStart);
  setText("mob-btn", t.mobButton);
  setText("clear-route", t.clearRoute);
  setText("export-gpx", t.exportGpx);
  setText("import-gpx-label", t.importGpx);
  setText("save-route", t.saveRoute);
  setText("route-history-label", t.routeHistoryLabel);
  setText("route-distance-title", t.routeDistanceTitle);
  setText("charts-title", t.chartsTitle);
  setText("charts-description", t.chartsDescription);
  setText("depths-title", t.depthsTitle);
  setText("depths-description", t.depthsDescription);
  setText("depth-safety-note", t.depthSafetyNote);
  renderDepthSourceStatus();
  setText("provider-health-title", t.providerHealthTitle);
  setText("provider-health-status", t.providerHealthChecking);
  setText("data-source-title", t.dataSourceTitle);
  setText("data-source-warning", t.dataSourceWarning);
  setText("boat-settings-title", t.boatSettingsTitle);
  setText("boat-length-label", t.boatLengthLabel);
  setText("boat-speed-label", t.boatSpeedLabel);
  setText("boat-consumption-label", t.boatConsumptionLabel);
  setText("min-depth-label", t.minDepthLabel);
  setText("distance-unit-label", t.distanceUnitLabel);
  setText("estimates-title", t.estimatesTitle);
  setText("offline-title", t.offlineTitle);
  setText("offline-description", t.offlineDescription);
  setText("offline-name-label", t.offlineNameLabel);
  document
    .getElementById("offline-area-name")
    ?.setAttribute("placeholder", t.offlineNamePlaceholder);
  setText("offline-area-list-label", t.offlineAreaListLabel);
  setText("offline-min-zoom-label", t.offlineMinZoom);
  setText("offline-max-zoom-label", t.offlineMaxZoom);
  setText("download-offline", t.downloadOffline);
  setText("cancel-offline", t.cancelOffline);
  setText("load-offline", t.loadOffline);
  setText("delete-offline", t.deleteOffline);
  setText("clear-offline", t.clearOffline);
  setText("install-app", t.installApp);
  setText("offline-status-title", t.offlineStatusTitle);
  setText("map-footer", layerErrorShown ? t.layerLoadError : t.footer);
  setText("legend-title", t.legendTitle);
  setText("close-menu", "×");
  document.getElementById("close-menu")?.setAttribute("aria-label", t.closeMenu);
  setSidebarCollapsed(sidebarCollapsed);
  setDepthPanelCollapsed(depthPanelCollapsed);
  setDepthLegendCollapsed(depthLegendCollapsed);

  if (navButtons[0]) navButtons[0].textContent = t.navNavigation;
  if (navButtons[1]) navButtons[1].textContent = t.navCharts;
  if (navButtons[2]) navButtons[2].textContent = t.navSettings;
  if (navButtons[3]) navButtons[3].textContent = t.navOffline;

  renderTheme();
  renderGpsButtonState();
  renderGpsDiagnostics();
  renderWaypointButtonState();
  renderMeasureButtonState();
  renderOrientationButton();
  renderWaypointList();
  renderRouteHistory();
  renderOfflineAreas();
  renderPwaStatus();
  renderBoatPreview();
  renderDepthStatus();
  renderProviderMetadata();
  renderDataSourcePanel();

  const gpsStatus = document.getElementById("gps-status");
  if (gpsStatus) {
    gpsStatus.textContent = currentPosition.positions.length
      ? gpsStatus.textContent
      : t.gpsStatusWaiting;
  }

  const routeDistance = document.getElementById("route-distance");
  if (routeDistance && routeState.markers.length === 0)
    routeDistance.textContent = t.routeEmpty;

  const gpsMetrics = document.getElementById("gps-metrics");
  if (gpsMetrics && currentPosition.positions.length === 0) {
    gpsMetrics.textContent = t.gpsMetrics("--", "--");
  }
  renderGpsDiagnostics();
}

const boatSettings = {
  length: 12,
  speed: 18,
  consumption: 35,
  minDepth: 2,
  units: "metric",
};

/**
 * Main Leaflet map instance for all navigation, rotation, and layer operations.
 */
const map = createMap(L, "map");
createMapPanes(map);
if (typeof window !== "undefined") {
  window.__marineNavigator = {
    get map() {
      return map;
    },
    get orientationMode() {
      return orientationMode;
    },
    get currentPosition() {
      return currentPosition;
    },
    layers: {},
  };
}

/**
 * Base map layers exposed through the Leaflet layer control.
 *
 * Provider metadata lives in `src/config.js`; these tile layers only bind the
 * current URLs and attribution to Leaflet.
 */
const baseLayers = {
  Default: L.tileLayer(TILE_SOURCES.Default, {
    attribution: PROVIDERS.openstreetmap.attribution,
  }),
  Satelitas: L.tileLayer(TILE_SOURCES.Satelitas, {
    attribution: PROVIDERS.esriImagery.attribution,
  }),
  Terra: L.tileLayer(TILE_SOURCES.Terra, {
    attribution: PROVIDERS.esriTerrain.attribution,
  }),
};

/**
 * Depth soundings raster overlay from EMODnet.
 *
 * This layer is optional because it can obscure the map; numeric point depth is
 * still queried through the EMODnet REST endpoint on tap/click.
 */
const depthLayer = L.tileLayer.wms(WMS_SOURCES.emodnet, {
  layers: primaryDepthSource.layers.soundings,
  format: "image/png",
  transparent: true,
  version: "1.1.1",
  crs: L.CRS.EPSG3857,
  pane: "depthPane",
  opacity: 0.86,
  tileSize: 256,
  noWrap: true,
  updateWhenZooming: false,
  updateWhenIdle: true,
  keepBuffer: 1,
  zIndex: 420,
  attribution: PROVIDERS.emodnetBathymetry.attribution,
  className: "depth-tile",
});

/**
 * EMODnet contour/isobath overlay enabled by default where provider tiles render.
 */
const contourLayer = L.tileLayer.wms(WMS_SOURCES.emodnet, {
  layers: primaryDepthSource.layers.contours,
  format: "image/png",
  transparent: true,
  version: "1.1.1",
  crs: L.CRS.EPSG3857,
  pane: "contourPane",
  opacity: 1,
  tileSize: 256,
  noWrap: true,
  updateWhenZooming: false,
  updateWhenIdle: true,
  keepBuffer: 1,
  zIndex: 430,
  attribution: PROVIDERS.emodnetBathymetry.attribution,
  className: "contour-tile",
});

/**
 * EMODnet source-reference overlay used to show survey/source context.
 */
const sonarLayer = L.tileLayer.wms(WMS_SOURCES.emodnet, {
  layers: "emodnet:source_references",
  format: "image/png",
  transparent: true,
  version: "1.1.1",
  crs: L.CRS.EPSG3857,
  pane: "sonarPane",
  opacity: 0.72,
  tileSize: 256,
  noWrap: true,
  updateWhenZooming: false,
  updateWhenIdle: true,
  keepBuffer: 1,
  attribution: PROVIDERS.emodnetBathymetry.attribution,
});

/**
 * Optional GEBCO visual relief layer.
 *
 * This is approximate seabed relief only and must not be presented as numeric
 * soundings or certified navigation data.
 */
const reliefLayer = L.tileLayer.wms(WMS_SOURCES.gebco, {
  layers: fallbackDepthSource.layers.relief,
  format: "image/png",
  transparent: true,
  version: "1.3.0",
  crs: L.CRS.EPSG3857,
  pane: "reliefPane",
  opacity: 0.34,
  tileSize: 256,
  noWrap: true,
  updateWhenZooming: false,
  updateWhenIdle: true,
  keepBuffer: 1,
  attribution: PROVIDERS.gebcoRelief.attribution,
  className: "relief-tile",
});
const trackLayer = L.layerGroup().addTo(map);
if (typeof window !== "undefined" && window.__marineNavigator) {
  window.__marineNavigator.layers = {
    depthLayer,
    contourLayer,
    sonarLayer,
    reliefLayer,
  };
}

baseLayers.Default.addTo(map);

/**
 * Shows one visible warning when an external map or WMS layer fails.
 *
 * @returns {void}
 */
function reportLayerLoadError() {
  if (layerErrorShown) return;
  layerErrorShown = true;
  setText("map-footer", TEXT[lang].layerLoadError);
}

/**
 * Parses stored offline area bounds from `west,south,east,north` string form.
 *
 * @param {string} boundsValue Serialized bounds.
 * @returns {{west: number, south: number, east: number, north: number}|null} Parsed bounds.
 */
function parseOfflineBounds(boundsValue) {
  if (typeof boundsValue !== "string") return null;
  const parts = boundsValue.split(",").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null;
  const [west, south, east, north] = parts;
  return { west, south, east, north };
}

/**
 * Finds the saved offline area containing the current map center.
 *
 * @returns {object|undefined} Matching offline area metadata.
 */
function getOfflineAreaForCurrentView() {
  const center = map.getCenter();
  return readOfflineAreas().find((area) => {
    const bounds = parseOfflineBounds(area.bounds);
    if (!bounds) return false;
    return (
      center.lat >= bounds.south &&
      center.lat <= bounds.north &&
      center.lng >= bounds.west &&
      center.lng <= bounds.east
    );
  });
}

/**
 * Computes the detailed depth status text shown in the diagnostics panel.
 *
 * @returns {string} Localized status text.
 */
function getDepthStatusText() {
  const t = TEXT[lang] || TEXT.lt;

  if (!navigator.onLine) {
    if (!getOfflineAreaForCurrentView()) return t.depthOfflineUnavailableForArea;
    return contourLayerStatus.loaded
      ? t.depthStatusOffline
      : t.depthStatusUnknownQuality;
  }

  if (isDepthLayerHiddenAtCurrentZoom()) return t.depthStatusUnknownQuality;
  if (contourLayerStatus.failed) return t.depthContoursUnavailable;
  if (contourLayerStatus.loaded) return t.depthStatusOnline;
  return t.depthStatusUnknownQuality;
}

/**
 * Computes the compact depth chip label.
 *
 * @returns {string} Localized chip text.
 */
function getDepthChipText() {
  const t = TEXT[lang] || TEXT.lt;

  if (contourLayerStatus.failed) return t.depthStatusUnavailable;
  if (!navigator.onLine) {
    return getOfflineAreaForCurrentView()
      ? t.depthStatusOffline
      : t.depthStatusUnavailable;
  }
  return contourLayerStatus.loaded ? t.depthStatusOnline : t.depthStatusUnavailable;
}

/**
 * Checks whether the active zoom is outside the depth layer's configured range.
 *
 * @returns {boolean} True when the depth overlay should be treated as hidden by zoom.
 */
function isDepthLayerHiddenAtCurrentZoom() {
  const zoom = map.getZoom();
  const minZoom = depthLayer.options.minZoom;
  const maxZoom = depthLayer.options.maxZoom;
  return (
    (Number.isFinite(minZoom) && zoom < minZoom) ||
    (Number.isFinite(maxZoom) && zoom > maxZoom)
  );
}

/**
 * Selects the user-facing diagnostic message for depth overlay availability.
 *
 * @returns {string} Localized diagnostic text.
 */
function getDepthLayerDiagnosticMessage() {
  const t = TEXT[lang] || TEXT.lt;

  if (isDepthLayerHiddenAtCurrentZoom()) return t.depthLayerHiddenAtZoom;
  if (contourLayerStatus.failed) return t.depthContoursUnavailable;
  if (!navigator.onLine && !getOfflineAreaForCurrentView()) {
    return t.depthLayerUnavailableArea;
  }
  if (contourLayerStatus.loaded) return t.depthLayerAvailableHere;
  return t.depthLayerHiddenAtZoom;
}

/**
 * Converts the latest WMS tile request state into localized diagnostics text.
 *
 * @returns {string} Localized request status.
 */
function getDepthRequestText() {
  const t = TEXT[lang] || TEXT.lt;
  if (contourLayerStatus.requestState === "succeeded") return t.depthRequestSucceeded;
  if (contourLayerStatus.requestState === "failed") return t.depthRequestFailed;
  return t.depthRequestPending;
}

/**
 * Formats current map center coordinates for the debug panel.
 *
 * @returns {string} Latitude and longitude with fixed precision.
 */
function getDepthCenterText() {
  const center = map.getCenter();
  return `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`;
}

/**
 * Checks whether any WMS bathymetry-related overlay is currently on the map.
 *
 * @returns {boolean} True when redraw synchronization is needed.
 */
function hasActiveWmsBathymetryOverlays() {
  return [depthLayer, contourLayer, sonarLayer, reliefLayer].some((layer) =>
    map.hasLayer(layer),
  );
}

/**
 * Renders continuous depth overlay status, numeric-depth guidance, and debug text.
 *
 * @returns {void}
 */
function renderDepthStatus() {
  setText("depth-chip", getDepthChipText());
  setText("depth-status", getDepthStatusText());
  setText(
    "continuous-depth-status",
    contourLayerStatus.failed
      ? TEXT[lang].depthContoursUnavailable
      : contourLayerStatus.loaded
      ? TEXT[lang].continuousDepthVisible
      : TEXT[lang].continuousDepthChecking,
  );
  setText("numeric-depth-status", TEXT[lang].numericDepthTapOnly);
  setText(
    "depth-debug",
    `${getDepthLayerDiagnosticMessage()} · ${TEXT[lang].depthDebug({
      provider: primaryDepthSource.providerName,
      center: getDepthCenterText(),
      zoom: map.getZoom(),
      request: getDepthRequestText(),
      status: contourLayerStatus.httpStatus,
    })}`,
  );
}

/**
 * Renders primary/fallback/3D depth-source status controls.
 *
 * Experimental 3D is deliberately hidden until a real renderer exists.
 *
 * @returns {void}
 */
function renderDepthSourceStatus() {
  const t = TEXT[lang] || TEXT.lt;
  const fallbackButton = document.getElementById("use-fallback-depth");
  const experimental3dButton = document.getElementById("experimental-3d-toggle");

  setText("primary-depth-source", t.primaryDepthSource(primaryDepthSource.name));
  setText(
    "fallback-depth-status",
    fallbackDepthStatus.enabled
      ? t.fallbackBathymetryEnabled
      : fallbackDepthStatus.available
      ? t.fallbackBathymetryAvailable
      : t.fallbackBathymetryUnavailable,
  );
  setText("fallback-depth-quality", t.fallbackBathymetryQuality(fallbackDepthSource.quality));
  setText("use-fallback-depth", t.useFallbackBathymetry);
  setText("experimental-3d-toggle", t.experimental3dSeabed);
  if (experimental3dButton) {
    // TODO:
    // Experimental 3D bathymetry is not implemented yet.
    experimental3dButton.hidden = true;
    experimental3dButton.disabled = true;
  }
  if (fallbackButton) {
    fallbackButton.toggleAttribute("disabled", !fallbackDepthStatus.available);
  }
}

/**
 * Renders the provider registry into the charts/status panel.
 *
 * @returns {void}
 */
function renderProviderMetadata() {
  const list = document.getElementById("provider-metadata-list");
  if (!list) return;

  list.innerHTML = "";
  Object.values(PROVIDERS).forEach((provider) => {
    const item = document.createElement("li");
    item.textContent =
      `${provider.displayName}: ${provider.layerType} · ${provider.dataType} · ` +
      `quality ${provider.quality} · safety ${provider.safetyUse} · ` +
      `offline ${provider.offlineAllowed} · attribution ${provider.attribution}`;
    list.appendChild(item);
  });
}

/**
 * Renders one provider metadata definition list.
 *
 * @param {string} elementId Target element id.
 * @param {string} roleLabel Human-readable role label.
 * @param {object} provider Provider registry entry.
 * @returns {void}
 */
function renderProviderDefinitionList(elementId, roleLabel, provider) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const fields = TEXT[lang].providerMetadataField;
  element.innerHTML = "";
  [
    [fields.provider, `${roleLabel}: ${provider.displayName}`],
    [fields.dataType, provider.dataType],
    [fields.quality, provider.quality],
    [fields.safetyUse, provider.safetyUse],
    [fields.offlineAllowed, provider.offlineAllowed],
    [fields.attribution, provider.attribution],
  ].forEach(([label, value]) => {
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = value;
    element.append(term, description);
  });
}

/**
 * Renders the compact data-source panel for active depth and relief providers.
 *
 * @returns {void}
 */
function renderDataSourcePanel() {
  const t = TEXT[lang] || TEXT.lt;
  renderProviderDefinitionList(
    "active-depth-provider",
    t.dataSourceRoleDepth,
    PROVIDERS.emodnetBathymetry,
  );
  renderProviderDefinitionList(
    "relief-provider",
    t.dataSourceRoleRelief,
    PROVIDERS.gebcoRelief,
  );
}

/**
 * Enables the optional GEBCO visual relief overlay after explicit user action.
 *
 * This is visual-only relief, not numeric depth data and not a 3D renderer.
 *
 * @returns {void}
 */
function useFallbackBathymetry() {
  const t = TEXT[lang] || TEXT.lt;
  if (!fallbackDepthStatus.available) {
    setText("fallback-depth-status", t.fallbackBathymetryUnavailable);
    return;
  }

  if (!map.hasLayer(reliefLayer)) {
    reliefLayer.addTo(map);
  }
  fallbackDepthStatus.enabled = true;
  setText("fallback-depth-status", t.fallbackBathymetryEnabled);
}

/**
 * Extracts the actual WMS tile URL from a Leaflet tile event.
 *
 * @param {object} event Leaflet tile event.
 * @returns {string} Tile URL when available.
 */
function getTileUrl(event) {
  return event?.tile?.currentSrc || event?.tile?.src || "";
}

/**
 * Logs WMS tile URLs during development without exposing them in production UI.
 *
 * @param {string} url Tile URL.
 * @returns {void}
 */
function logDepthTileUrl(url) {
  if (import.meta.env.DEV && url) {
    console.debug("Depth WMS tile URL:", url);
  }
}

/**
 * Attempts to resolve the HTTP status for a failed WMS tile request.
 *
 * @param {string} url Tile URL.
 * @returns {Promise<string>} Human-readable HTTP status.
 */
async function resolveDepthHttpStatus(url) {
  if (!url) return "status unavailable";
  try {
    const response = await fetch(url, { cache: "no-store" });
    return `HTTP ${response.status}`;
  } catch (error) {
    return "status unavailable";
  }
}

/**
 * Updates WMS status after a successful tile load.
 *
 * @param {object} status Mutable status object for the layer.
 * @param {object} event Leaflet tile event.
 * @returns {void}
 */
function reportWmsLayerLoaded(status, event) {
  const url = getTileUrl(event);
  logDepthTileUrl(url);
  status.loaded = true;
  status.failed = false;
  status.requestState = "succeeded";
  status.httpStatus = "OK";
  status.lastUrl = url;
  renderDepthStatus();
}

/**
 * Updates WMS status after a tile load error and shows a visible warning.
 *
 * @param {object} status Mutable status object for the layer.
 * @param {object} event Leaflet tile event.
 * @returns {void}
 */
function reportWmsLayerLoadError(status, event) {
  const url = getTileUrl(event);
  logDepthTileUrl(url);
  status.failed = true;
  status.requestState = "failed";
  status.httpStatus = event?.error?.status
    ? `HTTP ${event.error.status}`
    : "status unavailable";
  status.lastUrl = url;
  reportLayerLoadError();
  renderDepthStatus();
  resolveDepthHttpStatus(url).then((httpStatus) => {
    if (status.lastUrl !== url) return;
    status.httpStatus = httpStatus;
    renderDepthStatus();
  });
}

depthLayer.on("tileload", (event) => reportWmsLayerLoaded(depthLayerStatus, event));
depthLayer.on("tileerror", (event) => reportWmsLayerLoadError(depthLayerStatus, event));
contourLayer.on("tileload", (event) => reportWmsLayerLoaded(contourLayerStatus, event));
contourLayer.on("tileerror", (event) => reportWmsLayerLoadError(contourLayerStatus, event));

[depthLayer, contourLayer, sonarLayer, reliefLayer].forEach((layer) => {
  layer.on("add remove", () => {
    applyMapOrientation();
    renderOrientationButton();
  });
});

reliefLayer.on("add", () => {
  fallbackDepthStatus.enabled = true;
  renderDepthSourceStatus();
});
reliefLayer.on("remove", () => {
  fallbackDepthStatus.enabled = false;
  renderDepthSourceStatus();
});

[
  sonarLayer,
  reliefLayer,
].forEach((layer) => {
  layer.on("tileerror", reportLayerLoadError);
});
contourLayer.addTo(map);
sonarLayer.addTo(map);

/**
 * Rebuilds the Leaflet layer control so labels match the active language.
 *
 * @returns {void}
 */
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
      { collapsed: true, position: "topright" },
    )
    .addTo(map);
}

map.on("baselayerchange", (event) => {
  const layerEntries = Object.entries(baseLayers);
  const activeEntry = layerEntries.find(([, layer]) => layer === event.layer);
  if (activeEntry) activeBaseLayerKey = activeEntry[0];
  renderOfflineEstimate();
});

/**
 * Redraws only WMS overlays currently present on the map.
 *
 * @returns {void}
 */
function redrawVisibleWmsOverlays() {
  [depthLayer, contourLayer, sonarLayer, reliefLayer].forEach((layer) => {
    if (map.hasLayer(layer)) layer.redraw();
  });
}

/**
 * Debounces WMS redraws during zoom, pan, and rotate gestures.
 *
 * This reduces Android flicker while preserving the rotation-safe pane setup.
 *
 * @param {number} [delay=120] Delay in milliseconds before redraw.
 * @returns {void}
 */
function scheduleWmsOverlayRedraw(delay = 120) {
  window.clearTimeout(wmsRedrawTimer);
  wmsRedrawTimer = window.setTimeout(() => {
    syncWmsPaneTransform();
    redrawVisibleWmsOverlays();
    setWmsOverlayUpdating(false);
  }, delay);
}

/**
 * Keeps custom WMS pane transforms delegated to the shared Leaflet tile pane.
 *
 * The WMS panes are children of `tilePane`; clearing local transforms prevents
 * them from rotating independently from the base map.
 *
 * @returns {void}
 */
function syncWmsPaneTransform() {
  ["reliefPane", "depthPane", "contourPane", "sonarPane"].forEach((paneName) => {
    const pane = map.getPane(paneName);
    if (!pane) return;
    pane.style.transformOrigin = "";
    pane.style.transform = "";
  });
}

/**
 * Toggles a CSS state used while WMS tiles settle during gestures.
 *
 * @param {boolean} isUpdating Whether a WMS gesture/update is in progress.
 * @returns {void}
 */
function setWmsOverlayUpdating(isUpdating) {
  document.body.classList.toggle("wms-overlays-updating", isUpdating);
}

/**
 * Finishes a map gesture and schedules a stable WMS redraw.
 *
 * Also records the gesture end time so synthetic mobile click events do not
 * accidentally trigger depth queries immediately after pinch/drag gestures.
 *
 * @returns {void}
 */
function finishWmsOverlayUpdate() {
  mapGestureActive = false;
  lastMapGestureEndedAt = Date.now();
  scheduleWmsOverlayRedraw(120);
}

map.on("movestart zoomstart", () => {
  mapGestureActive = true;
  if (hasActiveWmsBathymetryOverlays()) {
    window.clearTimeout(wmsRedrawTimer);
    setWmsOverlayUpdating(true);
  }
});

map.on("moveend", () => {
  renderOfflineEstimate();
  renderDepthStatus();
  finishWmsOverlayUpdate();
});

map.on("zoomend rotateend", finishWmsOverlayUpdate);
map.on("rotate", () => {
  if (hasActiveWmsBathymetryOverlays()) scheduleWmsOverlayRedraw(180);
});

L.control.zoom({ position: "bottomright" }).addTo(map);

/**
 * Resolves the best available heading for heading-up and follow modes.
 *
 * Preference order is native GPS/course heading, inferred movement bearing,
 * then the latest route segment bearing.
 *
 * @returns {number} Bearing in degrees.
 */
function getActiveHeading() {
  const lastGpsPosition = currentPosition.positions[currentPosition.positions.length - 1];
  const lastGpsHeading = lastGpsPosition?.[2];
  if (Number.isFinite(lastGpsHeading)) {
    return lastGpsHeading;
  }

  if (currentPosition.positions.length >= 2) {
    const [lat1, lng1] =
      currentPosition.positions[currentPosition.positions.length - 2];
    const [lat2, lng2] =
      currentPosition.positions[currentPosition.positions.length - 1];
    return bearingBetweenPoints(
      { lat: lat1, lng: lng1 },
      { lat: lat2, lng: lng2 },
    );
  }

  const routePositions = routeState.markers.map((marker) => marker.getLatLng());
  if (routePositions.length >= 2) {
    return bearingBetweenPoints(
      routePositions[routePositions.length - 2],
      routePositions[routePositions.length - 1],
    );
  }

  return 0;
}

/**
 * Applies the selected navigation orientation mode to the map.
 *
 * North-up forces bearing 0. Heading-up and follow use the active GPS/course
 * heading when available, while preserving the WMS pane synchronization.
 *
 * @returns {void}
 */
function applyMapOrientation() {
  const t = TEXT[lang] || TEXT.lt;
  const targetBearing = orientationMode === "heading" || orientationMode === "follow"
    ? getActiveHeading()
    : 0;

  if (typeof map.setBearing === "function") {
    map.setBearing(targetBearing);
    syncWmsPaneTransform();
  } else if (orientationMode !== "north") {
    setText("map-footer", t.orientationUnavailable);
  }

  renderOrientationButton();
}

/**
 * Renders North, Heading, and Follow mode buttons.
 *
 * @returns {void}
 */
function renderOrientationButton() {
  const northButton = document.getElementById("orientation-toggle");
  const headingButton = document.getElementById("heading-toggle");
  const followButton = document.getElementById("follow-toggle");

  if (northButton) {
    northButton.textContent = TEXT[lang].orientationNorth;
    northButton.classList.toggle("is-active", orientationMode === "north");
    northButton.setAttribute("aria-pressed", String(orientationMode === "north"));
  }

  if (headingButton) {
    headingButton.textContent = TEXT[lang].orientationHeading;
    headingButton.classList.toggle("is-active", orientationMode === "heading");
    headingButton.setAttribute("aria-pressed", String(orientationMode === "heading"));
  }

  if (followButton) {
    followButton.textContent = TEXT[lang].orientationFollow;
    followButton.classList.toggle("is-active", orientationMode === "follow");
    followButton.setAttribute("aria-pressed", String(orientationMode === "follow"));
  }
}

/**
 * Requests an EMODnet numeric depth sample for a clicked map point.
 *
 * The same-origin proxy is preferred for CORS/cache control; a direct EMODnet
 * request is attempted only when the proxy fetch itself fails.
 *
 * @param {{lat: number, lng: number}} latlng Leaflet coordinate.
 * @returns {Promise<object>} EMODnet depth sample payload.
 */
async function fetchDepthSample(latlng) {
  const proxyUrl = `${PROXY_BASE_URL}/depth?lat=${encodeURIComponent(latlng.lat)}&lng=${encodeURIComponent(latlng.lng)}`;
  const directGeom = `POINT(${latlng.lng} ${latlng.lat})`;
  const directUrl = `https://rest.emodnet-bathymetry.eu/depth_sample?geom=${encodeURIComponent(directGeom)}`;
  const response = await fetch(proxyUrl, {
    headers: { Accept: "application/json" },
  }).catch(() =>
    fetch(directUrl, {
      headers: { Accept: "application/json" },
    }),
  );

  if (!response.ok) {
    throw new Error(`Depth request failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Shows the numeric depth popup for a map click/tap.
 *
 * A monotonically increasing query id prevents slow older responses from
 * overwriting the latest tap result on mobile.
 *
 * @param {{latlng: {lat: number, lng: number}}} event Leaflet click event.
 * @returns {Promise<void>}
 */
async function showDepthAtPoint(event) {
  const t = TEXT[lang] || TEXT.lt;
  const queryId = ++depthQuerySequence;
  const popup = L.popup()
    .setLatLng(event.latlng)
    .setContent(t.depthPopupLoading)
    .openOn(map);

  try {
    const sample = await fetchDepthSample(event.latlng);
    if (queryId !== depthQuerySequence) return;
    const depth = sample?.smoothed ?? sample?.avg ?? sample?.min ?? null;
    if (typeof depth === "number") {
      const depthValue = Math.abs(depth);
      const displayDepth = depthValue.toFixed(1);
      const content =
        depthValue < boatSettings.minDepth
          ? `${t.depthPopup(displayDepth)}<br>${t.shallowWarning(displayDepth, boatSettings.minDepth)}`
          : t.depthPopup(displayDepth);
      popup.setContent(content);
    } else {
      popup.setContent(t.depthPopupNoData);
    }
  } catch (error) {
    if (queryId !== depthQuerySequence) return;
    popup.setContent(t.depthPopupError);
  }
}

/**
 * Guards depth queries against drag/pinch gesture click leakage.
 *
 * Android browsers can fire click-like events after map gestures; this check
 * keeps one intentional tap mapped to one depth query.
 *
 * @param {object} event Leaflet click event.
 * @returns {boolean} True when the click should not query depth.
 */
function shouldIgnoreDepthMapClick(event) {
  if (mapGestureActive) return true;
  if (Date.now() - lastMapGestureEndedAt < 250) return true;
  return Boolean(event?.originalEvent?.defaultPrevented);
}

/**
 * Extracts the best available heading/course value from a geolocation position.
 *
 * Capacitor 8 exposes true heading, magnetic heading, heading, and course. The
 * app prefers true heading for heading-up mode, then falls back conservatively.
 *
 * @param {GeolocationPosition|import("@capacitor/geolocation").Position} position GPS position.
 * @returns {number|null} Heading/course in degrees or null.
 */
function getPositionHeading(position) {
  const coords = position?.coords || {};
  return [
    coords.trueHeading,
    coords.heading,
    coords.course,
    coords.magneticHeading,
  ].find((value) => Number.isFinite(value)) ?? null;
}

/**
 * Applies permission/source/accuracy diagnostics for a GPS fix.
 *
 * @param {GeolocationPosition|import("@capacitor/geolocation").Position} position GPS position.
 * @param {"browser"|"native"} source GPS source.
 * @returns {number|null} Heading/course selected for navigation.
 */
function updateGpsDiagnosticsFromPosition(position, source) {
  const heading = getPositionHeading(position);
  gpsDiagnostics.source = source;
  gpsDiagnostics.accuracy = position.coords.accuracy;
  gpsDiagnostics.heading = heading;
  gpsDiagnostics.headingAccuracy = position.coords.headingAccuracy ?? null;
  gpsDiagnostics.lastUpdate = position.timestamp || Date.now();
  gpsDiagnostics.permission = "granted";
  renderGpsDiagnostics();
  return heading;
}

/**
 * Updates the GPS marker, accuracy circle, track line, and navigation mode state.
 *
 * Follow mode recenters the map after each fix. Heading-up and follow both apply
 * the latest heading/course to the map bearing when possible.
 *
 * @param {number} lat Latitude.
 * @param {number} lng Longitude.
 * @param {number} accuracy Accuracy radius in meters.
 * @param {number|null} [speed=null] Speed in meters per second.
 * @param {number|null} [heading=null] Course/heading in degrees.
 * @returns {void}
 */
function updatePositionMarker(lat, lng, accuracy, speed = null, heading = null) {
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

  currentPosition.positions.push([lat, lng, Number.isFinite(heading) ? heading : null]);
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

  if (orientationMode === "follow") {
    map.panTo([lat, lng], { animate: true, duration: 0.6 });
  }
  document.getElementById("gps-status").textContent =
    TEXT[lang].gpsStatusActive(lat, lng);
  const speedKnots = metersPerSecondToKnots(speed);
  const headingLabel =
    typeof heading === "number" ? Math.round(heading).toString() : "--";
  document.getElementById("gps-metrics").textContent =
    TEXT[lang].gpsMetrics(speedKnots, headingLabel);
  applyMapOrientation();
}

/**
 * Applies one GPS position update from browser or Capacitor native watch.
 *
 * @param {GeolocationPosition|import("@capacitor/geolocation").Position} position GPS position.
 * @param {"browser"|"native"} source GPS source.
 * @returns {void}
 */
function handleGpsPosition(position, source) {
  if (!position?.coords) return;
  const heading = updateGpsDiagnosticsFromPosition(position, source);
  updatePositionMarker(
    position.coords.latitude,
    position.coords.longitude,
    position.coords.accuracy,
    position.coords.speed,
    heading,
  );
}

/**
 * Handles geolocation errors consistently for browser and native watches.
 *
 * @param {Error|GeolocationPositionError|object} error GPS error.
 * @returns {void}
 */
function handleGpsError(error) {
  const message = error?.message || error?.code || "GPS unavailable";
  gpsDiagnostics.permission =
    String(message).toLowerCase().includes("permission") ||
    String(message).toLowerCase().includes("denied")
      ? "denied"
      : gpsDiagnostics.permission;
  gpsDiagnostics.source = gpsWatchSource;
  renderGpsDiagnostics();

  if (gpsWatchId !== null && gpsWatchSource === "browser") {
    navigator.geolocation.clearWatch?.(gpsWatchId);
  }
  if (gpsWatchId !== null && gpsWatchSource === "native") {
    void clearNativePositionWatch(gpsWatchId);
  }
  gpsWatchId = null;
  gpsWatchSource = "none";
  gpsShouldRun = false;
  document.getElementById("gps-status").textContent =
    TEXT[lang].gpsStatusError(message);
  renderGpsButtonState();
}

/**
 * Shows or clears the waypoint-placement hint.
 *
 * @param {boolean} isOn Whether waypoint placement mode is active.
 * @returns {void}
 */
function updateWaypointModeUI(isOn) {
  const t = TEXT[lang] || TEXT.lt;
  const gpsStatus = document.getElementById("gps-status");
  if (!gpsStatus) return;

  if (isOn) {
    gpsStatus.textContent = t.waypointModeHint;
  } else if (currentPosition.positions.length) {
    const [lat, lng] =
      currentPosition.positions[currentPosition.positions.length - 1];
    gpsStatus.textContent = t.gpsStatusActive(lat, lng);
  } else {
    gpsStatus.textContent = t.gpsStatusWaiting;
  }

  renderWaypointButtonState();
}

/**
 * Starts GPS tracking with native and browser geolocation paths.
 *
 * Capacitor can provide an immediate native position on Android/iOS, while
 * `navigator.geolocation.watchPosition` keeps the live track updated.
 *
 * @returns {void}
 */
async function startNativeGpsWatch() {
  const permissionStatus = await requestNativeLocationPermission();
  if (!permissionStatus) return false;

  gpsDiagnostics.permission =
    permissionStatus.location === "granted" || permissionStatus.coarseLocation === "granted"
      ? "granted"
      : permissionStatus.location || permissionStatus.coarseLocation || "unknown";
  renderGpsDiagnostics();

  if (gpsDiagnostics.permission !== "granted") {
    throw new Error("Location permission denied");
  }

  const watchId = await startNativePositionWatch(
    (position) => handleGpsPosition(position, "native"),
    handleGpsError,
  );
  if (!watchId) return false;

  gpsWatchId = watchId;
  gpsWatchSource = "native";
  gpsDiagnostics.source = "native";
  renderGpsButtonState();
  renderGpsDiagnostics();
  return true;
}

function startBrowserGpsWatch() {
  if (!navigator.geolocation) {
    document.getElementById("gps-status").textContent = TEXT[lang].gpsUnavailable;
    gpsDiagnostics.source = "none";
    gpsDiagnostics.permission = "unknown";
    renderGpsDiagnostics();
    return false;
  }

  gpsWatchId = navigator.geolocation.watchPosition(
    (position) => handleGpsPosition(position, "browser"),
    handleGpsError,
    {
      enableHighAccuracy: true,
      maximumAge: GPS_WATCH_OPTIONS.maximumAge,
      timeout: GPS_WATCH_OPTIONS.timeout,
    },
  );
  gpsWatchSource = "browser";
  gpsDiagnostics.source = "browser";
  renderGpsButtonState();
  renderGpsDiagnostics();
  return true;
}

/**
 * Starts live GPS tracking using Capacitor native watch on Android/iOS when available.
 *
 * Browser geolocation remains the fallback for web and test environments.
 *
 * @param {{isRestart?: boolean}} [options={}] Restart context.
 * @returns {Promise<void>}
 */
async function geolocate(options = {}) {
  if (gpsWatchId !== null) {
    document.getElementById("gps-status").textContent = TEXT[lang].gpsAlreadyActive;
    renderGpsButtonState();
    return;
  }

  gpsShouldRun = true;
  try {
    const nativeStarted = isNativePlatform()
      ? await startNativeGpsWatch()
      : false;
    if (!nativeStarted && !startBrowserGpsWatch()) {
      gpsShouldRun = false;
    }
    if (options.isRestart && gpsWatchId !== null) {
      setText("gps-status", TEXT[lang].gpsRestarted);
    }

    getNativePosition().then((position) => {
      if (!position?.coords || gpsWatchSource !== "native") return;
      handleGpsPosition(position, "native");
    });
  } catch (error) {
    gpsShouldRun = false;
    gpsWatchId = null;
    gpsWatchSource = "none";
    gpsDiagnostics.source = "none";
    gpsDiagnostics.permission = String(error.message || "")
      .toLowerCase()
      .includes("permission")
      ? "denied"
      : gpsDiagnostics.permission;
    document.getElementById("gps-status").textContent =
      TEXT[lang].gpsStatusError(error.message);
    renderGpsButtonState();
    renderGpsDiagnostics();
  }
}

/**
 * Stops live GPS tracking while leaving the last known position on the map.
 *
 * @returns {void}
 */
async function stopGps({ silent = false } = {}) {
  if (gpsWatchId === null) {
    renderGpsButtonState();
    return;
  }

  if (gpsWatchSource === "native") {
    await clearNativePositionWatch(gpsWatchId);
  } else {
    navigator.geolocation.clearWatch?.(gpsWatchId);
  }
  gpsWatchId = null;
  gpsWatchSource = "none";
  gpsShouldRun = false;
  gpsDiagnostics.source = "none";
  document.getElementById("gps-status").textContent = TEXT[lang].gpsStopped;
  if (silent) {
    document.getElementById("gps-status").textContent = TEXT[lang].gpsStatusWaiting;
  }
  renderGpsButtonState();
  renderGpsDiagnostics();
}

/**
 * Restarts GPS after Android app resume, focus, or screen unlock.
 *
 * Some Android WebView/OS combinations stop delivering watch callbacks after
 * backgrounding or lock/unlock. Restarting only when the user previously chose
 * GPS tracking keeps battery impact bounded and avoids surprise tracking.
 *
 * @returns {Promise<void>}
 */
async function restartGpsAfterResume() {
  if (!gpsShouldRun || gpsRestarting) return;
  gpsRestarting = true;
  const shouldResume = gpsShouldRun;
  const previousWatchId = gpsWatchId;
  const previousSource = gpsWatchSource;

  try {
    if (previousWatchId !== null) {
      if (previousSource === "native") {
        await clearNativePositionWatch(previousWatchId);
      } else {
        navigator.geolocation.clearWatch?.(previousWatchId);
      }
      gpsWatchId = null;
      gpsWatchSource = "none";
    }
    if (shouldResume) await geolocate({ isRestart: true });
  } finally {
    gpsRestarting = false;
  }
}

/**
 * Reads boat settings from form controls and refreshes derived estimates.
 *
 * @returns {void}
 */
function setBoatSettingsFromUI() {
  boatSettings.length = Number(document.getElementById("boat-length").value);
  boatSettings.speed = Number(document.getElementById("boat-speed").value);
  boatSettings.consumption = Number(
    document.getElementById("boat-consumption").value,
  );
  boatSettings.minDepth = Number(document.getElementById("min-depth").value);
  boatSettings.units = document.getElementById("distance-unit").value;
  renderBoatPreview();
}

/**
 * Renders simple planning estimates from speed, consumption, and unit settings.
 *
 * @returns {void}
 */
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

/**
 * Adds a draggable route waypoint at the clicked map location.
 *
 * @param {{latlng: {lat: number, lng: number}}} event Leaflet click-like event.
 * @returns {void}
 */
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

/**
 * Deletes a route waypoint by list index.
 *
 * @param {number} index Route marker index.
 * @returns {void}
 */
function deleteRoutePoint(index) {
  const marker = routeState.markers[index];
  if (!marker) return;

  map.removeLayer(marker);
  routeState.markers.splice(index, 1);
  refreshRoute();
}

/**
 * Renders the route waypoint list in the navigation panel.
 *
 * @returns {void}
 */
function renderWaypointList() {
  const list = document.getElementById("waypoint-list");
  if (!list) return;

  list.innerHTML = "";

  if (routeState.markers.length === 0) {
    const item = document.createElement("li");
    item.className = "waypoint-empty";
    item.textContent = TEXT[lang].waypointListEmpty;
    list.appendChild(item);
    return;
  }

  routeState.markers.forEach((marker, index) => {
    const position = marker.getLatLng();
    const item = document.createElement("li");
    const label = document.createElement("span");
    const deleteButton = document.createElement("button");

    const coordinates = `${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}`;
    label.textContent = `${TEXT[lang].waypointLabel(index + 1)}: ${coordinates}`;
    deleteButton.type = "button";
    deleteButton.className = "mini-action";
    deleteButton.textContent = TEXT[lang].deleteWaypoint;
    deleteButton.addEventListener("click", () => deleteRoutePoint(index));

    item.append(label, deleteButton);
    list.appendChild(item);
  });
}

/**
 * Rebuilds the route polyline and recalculates total route distance.
 *
 * Route distance is the sum of Haversine segment distances between waypoints.
 *
 * @returns {void}
 */
function refreshRoute() {
  const positions = routeState.markers.map((marker) => marker.getLatLng());
  if (routeState.line) {
    map.removeLayer(routeState.line);
    routeState.line = null;
  }

  if (positions.length >= 2) {
    routeState.line = L.polyline(positions, {
      color: "#ffab00",
      weight: 5,
      opacity: 0.86,
    }).addTo(map);
  }

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

  renderWaypointList();
  applyMapOrientation();
}

/**
 * Removes all route waypoints and the route line from the map.
 *
 * @returns {void}
 */
function clearRoute() {
  routeState.markers.forEach((marker) => map.removeLayer(marker));
  routeState.markers = [];
  if (routeState.line) {
    map.removeLayer(routeState.line);
    routeState.line = null;
  }
  document.getElementById("route-distance").textContent = TEXT[lang].routeEmpty;
  renderWaypointList();
  applyMapOrientation();
}

/**
 * Returns route waypoints as plain JSON for history and GPX export.
 *
 * @returns {{lat: number, lng: number}[]} Route coordinates.
 */
function getRoutePositions() {
  return routeState.markers.map((marker) => {
    const position = marker.getLatLng();
    return { lat: position.lat, lng: position.lng };
  });
}

/**
 * Restores a route from coordinate objects.
 *
 * @param {{lat: number, lng: number}[]} positions Route coordinates.
 * @returns {void}
 */
function setRouteFromPositions(positions) {
  clearRoute();
  positions.forEach((position) => {
    addRoutePoint({ latlng: { lat: position.lat, lng: position.lng } });
  });
  refreshRoute();
}

/**
 * Exports the current route as GPX 1.1 route points.
 *
 * Capacitor builds also attempt to write the file to the native Documents
 * directory before triggering the browser download path.
 *
 * @returns {Promise<void>}
 */
async function exportRouteGpx() {
  const positions = getRoutePositions();
  if (positions.length === 0) {
    document.getElementById("route-distance").textContent = TEXT[lang].routeEmpty;
    return;
  }

  const points = positions
    .map((point) => `      <rtept lat="${point.lat}" lon="${point.lng}" />`)
    .join("\n");
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Marine Navigator" xmlns="http://www.topografix.com/GPX/1/1">
  <rte>
    <name>Marine Navigator Route</name>
${points}
  </rte>
</gpx>`;
  const blob = new Blob([gpx], { type: "application/gpx+xml" });
  const link = document.createElement("a");
  const fileName = `marine-route-${new Date().toISOString().slice(0, 10)}.gpx`;

  await writeTextFile(fileName, gpx);

  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}

/**
 * Imports route, track, or waypoint coordinates from a GPX file input.
 *
 * @param {Event} event File input change event.
 * @returns {Promise<void>}
 */
async function importRouteGpx(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const xml = await file.text();
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const nodes = doc.querySelectorAll("rtept, trkpt, wpt");
    const positions = Array.from(nodes)
      .map((node) => ({
        lat: Number(node.getAttribute("lat")),
        lng: Number(node.getAttribute("lon")),
      }))
      .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));

    if (positions.length === 0) throw new Error("No GPX points");

    setRouteFromPositions(positions);
    document.getElementById("route-distance").textContent =
      TEXT[lang].importGpxSuccess(positions.length);
  } catch (error) {
    document.getElementById("route-distance").textContent = TEXT[lang].importGpxError;
  } finally {
    event.target.value = "";
  }
}

/**
 * Saves the current route to local history, capped to the latest ten entries.
 *
 * @returns {void}
 */
function saveRouteToHistory() {
  const positions = getRoutePositions();
  if (positions.length === 0) return;

  const history = readRouteHistory();
  history.unshift({
    id: Date.now(),
    name: new Date().toLocaleString(),
    positions,
  });
  localStorage.setItem(ROUTE_HISTORY_KEY, JSON.stringify(history.slice(0, 10)));
  document.getElementById("route-distance").textContent = TEXT[lang].routeSaved;
  renderRouteHistory();
}

/**
 * Reads saved route history through the shared resilient storage helper.
 *
 * @returns {unknown[]} Saved route history.
 */
function readRouteHistory() {
  return readRouteHistoryFromStorage(localStorage, ROUTE_HISTORY_KEY);
}

/**
 * Renders the saved route selector.
 *
 * @returns {void}
 */
function renderRouteHistory() {
  const select = document.getElementById("route-history");
  if (!select) return;

  const history = readRouteHistory();
  select.innerHTML = "";

  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = TEXT[lang].routeHistoryEmpty;
  select.appendChild(emptyOption);

  history.forEach((route) => {
    const option = document.createElement("option");
    option.value = String(route.id);
    option.textContent = `${route.name} (${route.positions.length})`;
    select.appendChild(option);
  });
}

/**
 * Loads the route selected in the saved-route dropdown.
 *
 * @param {Event} event Select change event.
 * @returns {void}
 */
function loadRouteFromHistory(event) {
  const routeId = Number(event.target.value);
  if (!routeId) return;

  const history = readRouteHistory();
  const route = history.find((item) => item.id === routeId);
  if (route) setRouteFromPositions(route.positions);
}

/**
 * Clears temporary measurement markers and line.
 *
 * @returns {void}
 */
function clearMeasurement() {
  measureState.markers.forEach((marker) => map.removeLayer(marker));
  measureState.markers = [];
  if (measureState.line) {
    map.removeLayer(measureState.line);
    measureState.line = null;
  }
}

/**
 * Adds a point to the quick distance-measurement tool.
 *
 * Two points produce a line and a Haversine distance readout.
 *
 * @param {{latlng: {lat: number, lng: number}}} event Leaflet click event.
 * @returns {void}
 */
function addMeasurementPoint(event) {
  if (measureState.markers.length >= 2) clearMeasurement();

  const marker = L.circleMarker(event.latlng, {
    radius: 7,
    color: "#ffffff",
    fillColor: "#ffab00",
    fillOpacity: 0.95,
    weight: 2,
  }).addTo(map);
  measureState.markers.push(marker);

  if (measureState.markers.length === 2) {
    const [start, end] = measureState.markers.map((item) => item.getLatLng());
    const distance = distanceBetweenCoords(start.lat, start.lng, end.lat, end.lng);
    measureState.line = L.polyline([start, end], {
      color: "#ffffff",
      weight: 3,
      dashArray: "8,6",
    }).addTo(map);
    setText("map-footer", TEXT[lang].measureResult(distance));
  }
}

/**
 * Marks a man-overboard/SOS point from the latest GPS fix or map center.
 *
 * @returns {Promise<void>}
 */
async function markMobPoint() {
  const lastPosition = currentPosition.positions[currentPosition.positions.length - 1];
  const position = lastPosition
    ? { lat: lastPosition[0], lng: lastPosition[1] }
    : map.getCenter();

  if (mobMarker) map.removeLayer(mobMarker);
  mobMarker = L.marker(position).addTo(map).bindPopup(TEXT[lang].mobPopup).openPopup();
  setText("map-footer", TEXT[lang].mobSaved(position.lat, position.lng));

  await shareText(
    TEXT[lang].mobPopup,
    `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`,
  );
}

/**
 * Stores currently visible Leaflet tile images in the Cache API.
 *
 * @returns {Promise<number>} Number of successfully cached visible tiles.
 */
async function cacheVisibleTiles() {
  if (!("caches" in window)) return 0;

  const cache = await caches.open(CACHE_NAME);
  const urls = [
    ...new Set(
      Array.from(document.querySelectorAll("#map img.leaflet-tile"))
        .map((tile) => tile.currentSrc || tile.src)
        .filter(Boolean),
    ),
  ];

  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const response = await fetch(url, { mode: "no-cors" });
      if (response.ok || response.type === "opaque") {
        await cache.put(url, response.clone());
        return true;
      }
      return false;
    }),
  );

  return results.filter((result) => result.status === "fulfilled" && result.value)
    .length;
}

/**
 * Reads saved offline-region metadata from localStorage.
 *
 * @returns {object[]} Saved offline areas.
 */
function readOfflineAreas() {
  try {
    const areas = JSON.parse(localStorage.getItem(OFFLINE_AREAS_KEY) || "[]");
    return Array.isArray(areas) ? areas : [];
  } catch (error) {
    localStorage.removeItem(OFFLINE_AREAS_KEY);
    return [];
  }
}

/**
 * Persists offline-region metadata.
 *
 * @param {object[]} areas Offline area records.
 * @returns {void}
 */
function saveOfflineAreas(areas) {
  localStorage.setItem(OFFLINE_AREAS_KEY, JSON.stringify(areas));
}

/**
 * Formats timestamps using the active UI language.
 *
 * @param {number} timestamp Milliseconds since epoch.
 * @returns {string} Localized date/time.
 */
function formatDateTime(timestamp) {
  return new Intl.DateTimeFormat(lang === "lt" ? "lt-LT" : "en", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

/**
 * Returns the selected offline region, or the first saved region as fallback.
 *
 * @returns {object|null} Offline area metadata.
 */
function getSelectedOfflineArea() {
  const select = document.getElementById("offline-area-list");
  const areas = readOfflineAreas();
  const selectedId = select?.value || areas[0]?.id;
  return areas.find((area) => area.id === selectedId) || null;
}

/**
 * Renders the offline-region selector.
 *
 * @returns {void}
 */
function renderOfflineAreas() {
  const select = document.getElementById("offline-area-list");
  if (!select) return;

  const t = TEXT[lang] || TEXT.lt;
  const selectedId = select.value;
  const areas = readOfflineAreas();
  select.innerHTML = "";

  if (areas.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = t.offlineAreaEmpty;
    select.appendChild(option);
    return;
  }

  areas.forEach((area) => {
    const option = document.createElement("option");
    option.value = area.id;
    option.textContent = t.offlineAreaOption({
      ...area,
      dateLabel: formatDateTime(area.timestamp),
      sizeLabel: formatBytes(area.estimatedBytes || 0),
      zoomLabel: `${area.minZoom}-${area.maxZoom}`,
    });
    select.appendChild(option);
  });

  if (areas.some((area) => area.id === selectedId)) {
    select.value = selectedId;
  }
}

/**
 * Fetches and renders provider health diagnostics from the local proxy.
 *
 * @returns {Promise<void>}
 */
async function renderProviderHealth() {
  const status = document.getElementById("provider-health-status");
  const list = document.getElementById("provider-health-list");
  if (!status || !list) return;

  const t = TEXT[lang] || TEXT.lt;
  status.textContent = t.providerHealthChecking;
  list.innerHTML = "";

  try {
    const response = await fetch(`${PROXY_BASE_URL}/provider-health`, {
      headers: { Accept: "application/json" },
    });
    const health = await response.json();
    const providers = Array.isArray(health.providers) ? health.providers : [];
    status.textContent =
      health.ok && providers.length ? t.providerHealthOk : t.providerHealthPartial;

    providers.forEach((provider) => {
      const item = document.createElement("li");
      item.className = provider.ok ? "is-online" : "is-offline";
      item.textContent = t.providerHealthItem(
        t.providerNames[provider.id] || provider.id,
        provider.ok ? t.providerOnline : t.providerOffline,
        provider.latencyMs,
      );
      list.appendChild(item);
    });
  } catch (error) {
    status.textContent = t.providerHealthError;
  }
}

/**
 * Downloads and caches all tile URLs for an offline area.
 *
 * @param {string[]} urls Tile URLs to cache.
 * @param {AbortSignal} signal Abort signal for canceling downloads.
 * @returns {Promise<number>} Number of cached tiles.
 */
async function cacheTileUrls(urls, signal) {
  if (!("caches" in window)) return 0;

  const progress = document.getElementById("offline-progress");
  const cache = await caches.open(CACHE_NAME);
  let saved = 0;

  if (progress) {
    progress.value = 0;
    progress.max = urls.length || 1;
  }

  for (let index = 0; index < urls.length; index++) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      const response = await fetch(urls[index], { mode: "no-cors", signal });
      if (response.ok || response.type === "opaque") {
        await cache.put(urls[index], response.clone());
        saved++;
      }
    } catch (error) {
      // Individual tiles may fail because of network errors or provider limits.
    }

    if (progress) progress.value = index + 1;
    setText("offline-status", TEXT[lang].offlineDownloading(index + 1, urls.length));
  }

  return saved;
}

/**
 * Reads and clamps the requested offline zoom range.
 *
 * @returns {{minZoom: number, maxZoom: number}} Valid offline zoom range.
 */
function getOfflineZoomRange() {
  const currentZoom = map.getZoom();
  const minInput = Number(document.getElementById("offline-min-zoom").value);
  const maxInput = Number(document.getElementById("offline-max-zoom").value);
  const minZoom = Math.max(1, Math.min(18, Number.isFinite(minInput) ? minInput : currentZoom));
  const maxZoom = Math.max(minZoom, Math.min(18, Number.isFinite(maxInput) ? maxInput : minZoom));

  return { minZoom, maxZoom };
}

/**
 * Estimates tile count, cache size, and available browser storage for the map view.
 *
 * @returns {Promise<void>}
 */
async function renderOfflineEstimate() {
  const element = document.getElementById("offline-estimate");
  if (!element || !map) return;

  const bounds = map.getBounds();
  const { minZoom, maxZoom } = getOfflineZoomRange();
  const template = TILE_SOURCES[activeBaseLayerKey] || TILE_SOURCES.Default;
  const tileUrls = generateOfflineTileUrls(bounds, minZoom, maxZoom, template);
  const estimatedSize = estimateTileCacheSize(tileUrls.length);
  const estimate = TEXT[lang].offlineEstimate(tileUrls.length, formatBytes(estimatedSize));

  if (navigator.storage?.estimate) {
    const storage = await navigator.storage.estimate();
    const usage = formatBytes(storage.usage || 0);
    const quota = formatBytes(storage.quota || 0);
    element.textContent = `${estimate} · ${TEXT[lang].offlineQuota(usage, quota)}`;
    return;
  }

  element.textContent = estimate;
}

/**
 * Saves the current map view as an offline area.
 *
 * The saved metadata records bounds, center, zoom range, base layer, tile URLs,
 * and a cache-progress estimate. It does not invent or cache external depth data.
 *
 * @returns {Promise<void>}
 */
async function downloadOfflineArea() {
  const bounds = map.getBounds();
  const { minZoom, maxZoom } = getOfflineZoomRange();
  const template = TILE_SOURCES[activeBaseLayerKey] || TILE_SOURCES.Default;
  const tileUrls = generateOfflineTileUrls(bounds, minZoom, maxZoom, template);
  const timestamp = Date.now();
  const nameInput = document.getElementById("offline-area-name");
  const name =
    nameInput?.value.trim() ||
    TEXT[lang].offlineAreaDefaultName(formatDateTime(timestamp));
  const estimatedBytes = estimateTileCacheSize(tileUrls.length);
  offlineAbortController = new AbortController();
  const center = map.getCenter();
  const offlineData = {
    id: `area-${timestamp}`,
    name,
    center: { lat: center.lat, lng: center.lng },
    zoom: map.getZoom(),
    timestamp,
    bounds: bounds.toBBoxString(),
    baseLayer: activeBaseLayerKey,
    minZoom,
    maxZoom,
    tileCount: tileUrls.length,
    cachedTileCount: 0,
    estimatedBytes,
    tileUrls,
    notes: "Saved map view / Išsaugotas žemėlapio vaizdas",
  };
  let cachedTileCount = 0;
  try {
    cachedTileCount =
      (await cacheTileUrls(tileUrls, offlineAbortController.signal)) +
      (await cacheVisibleTiles());
  } catch (error) {
    setText("offline-status", TEXT[lang].offlineCancelled);
    offlineAbortController = null;
    return;
  }
  offlineAbortController = null;
  offlineData.cachedTileCount = cachedTileCount;
  const areas = readOfflineAreas().filter((area) => area.id !== offlineData.id);
  areas.unshift(offlineData);
  saveOfflineAreas(areas.slice(0, 20));
  localStorage.setItem("marine-navigator-offline", JSON.stringify(offlineData));
  renderOfflineAreas();
  renderDepthStatus();
  const select = document.getElementById("offline-area-list");
  if (select) select.value = offlineData.id;
  document.getElementById("offline-status").textContent =
    TEXT[lang].offlineSaved(cachedTileCount);
}

/**
 * Cancels the active offline-area download when one is running.
 *
 * @returns {void}
 */
function cancelOfflineDownload() {
  offlineAbortController?.abort();
}

/**
 * Restores the selected saved map view.
 *
 * @returns {void}
 */
function loadOfflineArea() {
  const selectedArea = getSelectedOfflineArea();
  const legacyArea = localStorage.getItem("marine-navigator-offline");
  const data = selectedArea || (legacyArea ? JSON.parse(legacyArea) : null);
  if (!data) {
    document.getElementById("offline-status").textContent =
      TEXT[lang].offlineNoData;
    return;
  }
  map.setView([data.center.lat, data.center.lng], data.zoom);
  document.getElementById("offline-status").textContent = TEXT[lang].offlineLoaded;
  renderDepthStatus();
}

/**
 * Deletes the selected offline area metadata and its cached tiles.
 *
 * @returns {Promise<void>}
 */
async function deleteSelectedOfflineArea() {
  const selectedArea = getSelectedOfflineArea();
  if (!selectedArea) {
    document.getElementById("offline-status").textContent =
      TEXT[lang].offlineNoData;
    return;
  }

  if ("caches" in window) {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all((selectedArea.tileUrls || []).map((url) => cache.delete(url)));
  }

  const areas = readOfflineAreas().filter((area) => area.id !== selectedArea.id);
  saveOfflineAreas(areas);
  if (localStorage.getItem("marine-navigator-offline")?.includes(selectedArea.id)) {
    localStorage.removeItem("marine-navigator-offline");
  }
  renderOfflineAreas();
  renderDepthStatus();
  setText("offline-status", TEXT[lang].offlineDeleted);
}

/**
 * Clears PWA/runtime caches and saved offline-area metadata.
 *
 * @returns {Promise<void>}
 */
async function clearOfflineCache() {
  if ("caches" in window) {
    await caches.delete(CACHE_NAME);
    await caches.delete(RUNTIME_CACHE_NAME);
  }
  localStorage.removeItem("marine-navigator-offline");
  localStorage.removeItem(OFFLINE_AREAS_KEY);
  renderOfflineAreas();
  renderDepthStatus();
  setText("offline-status", TEXT[lang].pwaCacheCleared);
  setText("pwa-status", TEXT[lang].pwaCacheCleared);
}

/**
 * Opens the browser PWA install prompt when available.
 *
 * @returns {Promise<void>}
 */
async function installApp() {
  if (!deferredInstallPrompt) {
    setText("pwa-status", TEXT[lang].installUnavailable);
    return;
  }

  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  renderPwaStatus();
}

/**
 * Opens one sidebar tab inside the modal menu window.
 *
 * @param {string} tabName Tab panel id.
 * @returns {void}
 */
function activateTab(tabName) {
  const t = TEXT[lang] || TEXT.lt;
  const menuWindow = document.getElementById("menu-window");
  const menuTitle = document.getElementById("menu-title");
  const closeButton = document.getElementById("close-menu");
  const trigger = document.querySelector(`.nav-tabs button[data-tab="${tabName}"]`);

  if (trigger) {
    lastMenuTrigger = trigger;
  }

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
    menuWindow.removeAttribute("inert");
    closeButton?.focus();
  }
}

/**
 * Closes the modal menu and restores focus to the triggering tab button.
 *
 * @returns {void}
 */
function closeMenu() {
  const menuWindow = document.getElementById("menu-window");
  if (!menuWindow) return;

  const wasOpen = !menuWindow.classList.contains("hidden");
  if (wasOpen) {
    const fallbackTrigger = document.querySelector(".nav-tabs button.active");
    const returnTarget = lastMenuTrigger || fallbackTrigger;
    returnTarget?.focus();

    if (menuWindow.contains(document.activeElement)) {
      document.activeElement.blur();
    }
  }

  menuWindow.classList.add("hidden");
  menuWindow.setAttribute("aria-hidden", "true");
  menuWindow.setAttribute("inert", "");
  document.querySelectorAll(".nav-tabs button").forEach((btn) => {
    btn.classList.remove("active");
  });
}

/**
 * Wires DOM events for controls, forms, map clicks, keyboard shortcuts, and layout.
 *
 * The map click handler routes clicks in priority order: measurement, waypoint
 * placement, then EMODnet depth query. This keeps depth query behavior from
 * interfering with route-planning modes.
 *
 * TODO:
 * This function is longer than 100 lines and should later be split into setup
 * helpers for navigation, charts/depth, offline, and global shell controls.
 *
 * @returns {void}
 */
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
    .getElementById("min-depth")
    .addEventListener("input", setBoatSettingsFromUI);
  document
    .getElementById("distance-unit")
    .addEventListener("change", setBoatSettingsFromUI);
  document
    .getElementById("offline-min-zoom")
    .addEventListener("input", renderOfflineEstimate);
  document
    .getElementById("offline-max-zoom")
    .addEventListener("input", renderOfflineEstimate);

  document.getElementById("clear-route").addEventListener("click", clearRoute);
  document
    .getElementById("download-offline")
    .addEventListener("click", downloadOfflineArea);
  document
    .getElementById("cancel-offline")
    .addEventListener("click", cancelOfflineDownload);
  document
    .getElementById("load-offline")
    .addEventListener("click", loadOfflineArea);
  document
    .getElementById("delete-offline")
    .addEventListener("click", deleteSelectedOfflineArea);
  document
    .getElementById("clear-offline")
    .addEventListener("click", clearOfflineCache);
  document.getElementById("install-app").addEventListener("click", installApp);
  document.getElementById("export-gpx").addEventListener("click", exportRouteGpx);
  document.getElementById("import-gpx").addEventListener("change", importRouteGpx);
  document.getElementById("save-route").addEventListener("click", saveRouteToHistory);
  document
    .getElementById("route-history")
    .addEventListener("change", loadRouteFromHistory);
  document.getElementById("mob-btn").addEventListener("click", markMobPoint);
  document
    .getElementById("use-fallback-depth")
    .addEventListener("click", useFallbackBathymetry);
  document.getElementById("collapse-sidebar")?.addEventListener("click", collapseSidebar);
  document.getElementById("open-sidebar")?.addEventListener("click", openSidebar);
  document.getElementById("sidebar-backdrop")?.addEventListener("click", collapseSidebar);
  document.getElementById("toggle-depth-panel")?.addEventListener("click", toggleDepthPanel);
  document.getElementById("depth-chip")?.addEventListener("click", () => {
    setDepthPanelCollapsed(false);
    document.getElementById("toggle-depth-panel")?.focus();
  });
  document.getElementById("toggle-depth-legend")?.addEventListener("click", toggleDepthLegend);
  mobileLayoutQuery?.addEventListener?.("change", renderResponsiveSidebarState);

  document.querySelectorAll(".nav-tabs button").forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.tab));
  });

  document.getElementById("close-menu").addEventListener("click", closeMenu);
  document.getElementById("menu-window").addEventListener("click", (event) => {
    if (event.target.id === "menu-window") closeMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;

    if (waypointMode) {
      waypointMode = false;
      updateWaypointModeUI(false);
    }
    if (measureMode) {
      measureMode = false;
      renderMeasureButtonState();
      setText("map-footer", TEXT[lang].footer);
    }
    closeMenu();
    if (isMobileLayout() && !sidebarCollapsed) {
      collapseSidebar();
    }
  });

  // Buttons are wired by ID so shared classes do not attach handlers twice.
  const gpsStartBtn = document.getElementById("gps-start");
  if (gpsStartBtn) gpsStartBtn.addEventListener("click", geolocate);

  const gpsStopBtn = document.getElementById("gps-stop");
  if (gpsStopBtn) gpsStopBtn.addEventListener("click", stopGps);

  const waypointBtn = document.getElementById("waypoint-mode-btn");
  if (waypointBtn) {
    waypointBtn.addEventListener("click", () => {
      waypointMode = !waypointMode;
      updateWaypointModeUI(waypointMode);
    });
  }

  const measureBtn = document.getElementById("measure-mode-btn");
  if (measureBtn) {
    measureBtn.addEventListener("click", () => {
      measureMode = !measureMode;
      waypointMode = false;
      renderWaypointButtonState();
      renderMeasureButtonState();
      setText("map-footer", measureMode ? TEXT[lang].measureActive : TEXT[lang].footer);
    });
  }

  const orientationToggle = document.getElementById("orientation-toggle");
  if (orientationToggle) {
    orientationToggle.addEventListener("click", () => {
      orientationMode = "north";
      localStorage.setItem("marine-navigator-orientation", orientationMode);
      applyMapOrientation();
    });
  }

  const headingToggle = document.getElementById("heading-toggle");
  if (headingToggle) {
    headingToggle.addEventListener("click", () => {
      orientationMode = "heading";
      localStorage.setItem("marine-navigator-orientation", orientationMode);
      applyMapOrientation();
    });
  }

  const followToggle = document.getElementById("follow-toggle");
  if (followToggle) {
    followToggle.addEventListener("click", () => {
      orientationMode = "follow";
      localStorage.setItem("marine-navigator-orientation", orientationMode);
      const lastPosition = currentPosition.positions[currentPosition.positions.length - 1];
      if (lastPosition) {
        map.panTo([lastPosition[0], lastPosition[1]], { animate: true, duration: 0.6 });
      }
      applyMapOrientation();
    });
  }

  map.on("click", (e) => {
    if (measureMode) {
      addMeasurementPoint(e);
      return;
    }

    if (waypointMode) {
      waypointMode = false;
      updateWaypointModeUI(false);
      addRoutePoint(e);
      return;
    }

    if (shouldIgnoreDepthMapClick(e)) return;
    showDepthAtPoint(e);
  });

  // Language and theme toggles re-render UI without rebuilding application state.
  const langToggle = document.getElementById("lang-toggle");
  if (langToggle) {
    langToggle.addEventListener("click", () => {
      lang = lang === "lt" ? "en" : "lt";
      localStorage.setItem("marine-navigator-lang", lang);
      document.documentElement.lang = lang;
      renderAllTexts();
      renderLayerControl();
      renderProviderHealth();
      applyMapOrientation();
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
  renderResponsiveSidebarState();
  setDepthPanelCollapsed(depthPanelCollapsed);
  setDepthLegendCollapsed(depthLegendCollapsed);
  setBoatSettingsFromUI();
  renderOfflineEstimate();
  renderDepthStatus();
}

/**
 * Initializes the app after the window load event.
 *
 * Registers the service worker for offline shell/runtime caching and then starts
 * the first render pass for map layers, status panels, and provider health.
 *
 * @returns {void}
 */
function init() {
  renderLayerControl();
  setupUI();
  document.getElementById("gps-status").textContent = TEXT[lang].gpsStatusWaiting;
  applyMapOrientation();
  renderProviderHealth();
  renderDepthStatus();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("service-worker.js")
      .then((registration) => registration.update())
      .catch(() => {});
  }
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  renderPwaStatus();
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  renderPwaStatus();
});

window.addEventListener("online", renderDepthStatus);
window.addEventListener("offline", renderDepthStatus);
window.addEventListener("focus", restartGpsAfterResume);
window.addEventListener("pageshow", restartGpsAfterResume);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    void restartGpsAfterResume();
  }
});

window.addEventListener("load", init);
