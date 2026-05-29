export const CACHE_NAME = "marine-navigator-map-cache-v3";
export const RUNTIME_CACHE_NAME = "marine-navigator-runtime-cache-v2";
export const ROUTE_HISTORY_KEY = "marine-navigator-route-history";
export const OFFLINE_AREAS_KEY = "marine-navigator-offline-areas";
export const PROXY_BASE_URL = "/api";
export const TILE_SOURCES = {
  Default: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  Satelitas:
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  Terra:
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
};
export const WMS_SOURCES = {
  emodnet: "https://ows.emodnet-bathymetry.eu/wms",
  gebco: "https://wms.gebco.net/mapserv",
};
export const DEPTH_SOURCES = {
  primary: {
    id: "emodnet",
    name: "EMODnet",
    providerName: "EMODnet Bathymetry",
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
    providerName: "GEBCO seabed relief",
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
