/**
 * Offline tile helpers.
 *
 * Converts Leaflet bounds into slippy-map tile URLs and provides rough storage
 * estimates for the offline download UI.
 */

/**
 * Converts geographic coordinates to a slippy-map tile index.
 *
 * @param {number} lat Latitude in degrees.
 * @param {number} lng Longitude in degrees.
 * @param {number} zoom Slippy-map zoom level.
 * @returns {{x: number, y: number}} Tile coordinates for the zoom level.
 */
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

/**
 * Generates base-map tile URLs for the selected area and zoom range.
 *
 * The function only expands the currently configured tile template; it does not
 * validate provider licensing or availability for offline use.
 *
 * @param {import("leaflet").LatLngBounds} bounds Leaflet bounds to cover.
 * @param {number} minZoom First zoom level to include.
 * @param {number} maxZoom Last zoom level to include.
 * @param {string} template Tile URL template containing `{s}`, `{z}`, `{x}`, `{y}`.
 * @returns {string[]} Tile URLs to fetch and cache.
 */
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

/**
 * Estimates local cache size for a number of map tiles.
 *
 * @param {number} tileCount Number of tiles.
 * @param {number} [averageTileKb=35] Assumed average tile size in KB.
 * @returns {number} Estimated byte count.
 */
export function estimateTileCacheSize(tileCount, averageTileKb = 35) {
  return tileCount * averageTileKb * 1024;
}

/**
 * Formats a byte count for compact UI display.
 *
 * @param {number} bytes Byte count.
 * @returns {string} Human-readable KB or MB value.
 */
export function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
