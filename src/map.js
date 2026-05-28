export function createMap(L, id) {
  return L.map(id, {
    center: [55.7, 21.1],
    zoom: 7,
    zoomControl: false,
    rotate: true,
    bearing: 0,
    touchRotate: true,
  });
}

export function createMapPanes(map) {
  map.createPane("reliefPane");
  map.createPane("depthPane");
  map.createPane("contourPane");
  map.createPane("sonarPane");
  map.getPane("reliefPane").style.zIndex = 430;
  map.getPane("depthPane").style.zIndex = 440;
  map.getPane("contourPane").style.zIndex = 450;
  map.getPane("sonarPane").style.zIndex = 460;
}
