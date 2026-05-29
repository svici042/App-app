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
