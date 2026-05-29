/**
 * Marine Navigator configuration.
 *
 * Centralizes cache keys, proxy paths, tile providers, WMS endpoints,
 * provider metadata, and depth-source categories used by the map UI.
 */

/**
 * Cache namespace for explicit offline map downloads.
 *
 * Bump this when cached map-tile semantics change.
 */
export const CACHE_NAME = "marine-navigator-map-cache-v3";

/**
 * Cache namespace for runtime app and tile responses handled by the service worker.
 */
export const RUNTIME_CACHE_NAME = "marine-navigator-runtime-cache-v2";

/**
 * Browser storage key for manually created route history.
 */
export const ROUTE_HISTORY_KEY = "marine-navigator-route-history";

/**
 * Browser storage key for user-defined offline map regions.
 */
export const OFFLINE_AREAS_KEY = "marine-navigator-offline-areas";

/**
 * Same-origin proxy base path for provider health, WMS, and EMODnet depth queries.
 */
export const PROXY_BASE_URL = "/api";

/**
 * Base map tile templates.
 *
 * OpenStreetMap is community data. Esri imagery and terrain are reference
 * background layers; the app does not treat any base map as certified navigation data.
 */
export const TILE_SOURCES = {
  Default: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  Satelitas:
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  Terra:
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
};

/**
 * WMS endpoints used for bathymetry overlays.
 *
 * EMODnet is the primary bathymetry source. GEBCO is optional visual relief only.
 */
export const WMS_SOURCES = {
  emodnet: "https://ows.emodnet-bathymetry.eu/wms",
  gebco: "https://wms.gebco.net/mapserv",
};

/**
 * Provider metadata displayed in the data-source UI and used by tests.
 *
 * `safetyUse` is intentionally conservative. None of these providers are marked
 * as certified primary-navigation data.
 */
export const PROVIDERS = {
  openstreetmap: {
    id: "openstreetmap",
    displayName: "OpenStreetMap",
    layerType: "tile",
    dataType: "base map",
    attribution: "© OpenStreetMap contributors",
    licenseUrl: "https://www.openstreetmap.org/copyright",
    offlineAllowed: "unknown",
    quality: "community",
    safetyUse: "referenceOnly",
  },
  esriImagery: {
    id: "esriImagery",
    displayName: "Esri World Imagery",
    layerType: "tile",
    dataType: "satellite imagery",
    attribution: "© Esri",
    licenseUrl: null,
    offlineAllowed: "unknown",
    quality: "unknown",
    safetyUse: "referenceOnly",
  },
  esriTerrain: {
    id: "esriTerrain",
    displayName: "Esri World Topo Map",
    layerType: "tile",
    dataType: "terrain/topographic base map",
    attribution: "© Esri",
    licenseUrl: null,
    offlineAllowed: "unknown",
    quality: "unknown",
    safetyUse: "referenceOnly",
  },
  emodnetBathymetry: {
    id: "emodnetBathymetry",
    displayName: "EMODnet Bathymetry",
    layerType: "wms",
    dataType: "bathymetry depth soundings and contours",
    attribution: "EMODnet Bathymetry",
    licenseUrl: "https://emodnet.ec.europa.eu/en/terms-use",
    offlineAllowed: "unknown",
    quality: "official",
    safetyUse: "referenceOnly",
  },
  gebcoRelief: {
    id: "gebcoRelief",
    displayName: "GEBCO relief",
    layerType: "wms",
    dataType: "visual seabed relief",
    attribution: "GEBCO",
    licenseUrl: "https://www.gebco.net/data_and_products/gridded_bathymetry_data/gebco_2023/grid_terms_of_use.html",
    offlineAllowed: "unknown",
    quality: "approximate",
    safetyUse: "visualOnly",
  },
};

/**
 * Depth-related source registry grouped by behavior category.
 *
 * The primary source can expose numeric/raster depth-related layers, the fallback
 * is approximate visual seabed relief, and 3D remains explicitly unimplemented.
 */
export const DEPTH_SOURCES = {
  primary: {
    id: "emodnet",
    name: "EMODnet",
    providerId: PROVIDERS.emodnetBathymetry.id,
    providerName: PROVIDERS.emodnetBathymetry.displayName,
    type: "wms",
    url: WMS_SOURCES.emodnet,
    categories: ["soundings", "contours"],
    layers: {
      soundings: "emodnet:mean_multicolour",
      contours: "emodnet:contours",
    },
    quality: "unknown",
    role: "primary",
  },
  fallback: {
    id: "gebco",
    name: "GEBCO",
    providerId: PROVIDERS.gebcoRelief.id,
    providerName: PROVIDERS.gebcoRelief.displayName,
    type: "wms",
    url: WMS_SOURCES.gebco,
    categories: ["relief"],
    layers: {
      relief: "GEBCO_LATEST",
    },
    quality: "low-resolution visual bathymetry, not safe depth data",
    role: "visual-relief",
  },
  experimental3d: {
    id: "experimental-3d",
    name: "Experimental 3D seabed",
    providerName: "Not configured",
    type: "visual",
    url: null,
    categories: ["3d"],
    layers: {},
    quality: "experimental visual terrain only",
    role: "experimental-3d",
    enabledByDefault: false,
  },
};
