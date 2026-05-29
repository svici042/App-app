/**
 * Leaflet map construction.
 *
 * Owns the low-level map options and custom panes used by bathymetry overlays.
 * The WMS panes are children of Leaflet's tile pane so rotation transforms stay
 * synchronized with base-map tiles.
 */

/**
 * Creates the main navigation map with rotation support enabled.
 *
 * @param {typeof import("leaflet")} L Leaflet namespace.
 * @param {string} id DOM element id for the map container.
 * @returns {import("leaflet").Map} Configured Leaflet map instance.
 */
export function createMap(L, id) {
  return L.map(id, {
    center: [55.7, 21.1],
    zoom: 7,
    zoomControl: false,
    zoomAnimation: false,
    markerZoomAnimation: false,
    rotate: true,
    bearing: 0,
    touchRotate: true,
  });
}

/**
 * Creates ordered panes for bathymetry and source-reference overlays.
 *
 * @param {import("leaflet").Map} map Leaflet map instance.
 * @returns {void}
 */
export function createMapPanes(map) {
  const tilePane = map.getPane("tilePane");
  map.createPane("reliefPane", tilePane);
  map.createPane("depthPane", tilePane);
  map.createPane("contourPane", tilePane);
  map.createPane("sonarPane", tilePane);
  map.getPane("reliefPane").style.zIndex = 430;
  map.getPane("depthPane").style.zIndex = 440;
  map.getPane("contourPane").style.zIndex = 450;
  map.getPane("sonarPane").style.zIndex = 460;
  ["reliefPane", "depthPane", "contourPane", "sonarPane"].forEach((paneName) => {
    map.getPane(paneName).style.pointerEvents = "none";
  });
}
