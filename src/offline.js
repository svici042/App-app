// LT: Paverčia geografines koordinates į slippy-map plytelės indeksą. / EN: Converts geographic coordinates to a slippy-map tile index.
export function latLngToTile(lat, lng, zoom) {
  const latRad = (lat * Math.PI) / 180;
  const scale = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * scale);
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
      scale,
  );

  return { x, y };
}

// LT: Sugeneruoja bazinio žemėlapio plytelių URL pasirinktai zonai ir zoom lygiams. / EN: Generates base-map tile URLs for the selected area and zoom levels.
export function generateOfflineTileUrls(bounds, minZoom, maxZoom, template) {
  const urls = [];

  for (let zoom = minZoom; zoom <= maxZoom; zoom++) {
    const northWest = latLngToTile(bounds.getNorth(), bounds.getWest(), zoom);
    const southEast = latLngToTile(bounds.getSouth(), bounds.getEast(), zoom);
    const minX = Math.min(northWest.x, southEast.x);
    const maxX = Math.max(northWest.x, southEast.x);
    const minY = Math.min(northWest.y, southEast.y);
    const maxY = Math.max(northWest.y, southEast.y);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        urls.push(
          template
            .replace("{s}", "a")
            .replace("{z}", zoom)
            .replace("{x}", x)
            .replace("{y}", y),
        );
      }
    }
  }

  return urls;
}

export function estimateTileCacheSize(tileCount, averageTileKb = 35) {
  return tileCount * averageTileKb * 1024;
}

export function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
