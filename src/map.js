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
