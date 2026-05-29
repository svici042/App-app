/**
 * Navigation route calculations.
 *
 * Contains pure math/storage helpers used by route planning, GPX tests,
 * heading calculations, and saved-route history.
 */

/**
 * Calculates great-circle distance between two coordinates using Haversine.
 *
 * @param {number} lat1 Start latitude in degrees.
 * @param {number} lng1 Start longitude in degrees.
 * @param {number} lat2 End latitude in degrees.
 * @param {number} lng2 End longitude in degrees.
 * @returns {number} Distance in kilometers.
 */
export function distanceBetweenCoords(lat1, lng1, lat2, lng2) {
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

/**
 * Calculates initial bearing from one point to another.
 *
 * @param {{lat: number, lng: number}} from Start coordinate.
 * @param {{lat: number, lng: number}} to End coordinate.
 * @returns {number} Bearing in degrees normalized to 0..359.
 */
export function bearingBetweenPoints(from, to) {
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const lngDiff = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(lngDiff) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(lngDiff);

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Reads saved route history from a storage-like object.
 *
 * Corrupted data is cleared so later route saves can recover cleanly.
 *
 * @param {{getItem: Function, removeItem: Function}} storage Storage adapter.
 * @param {string} key Storage key.
 * @returns {unknown[]} Parsed route history, or an empty list.
 */
export function readRouteHistory(storage, key) {
  try {
    const history = JSON.parse(storage.getItem(key) || "[]");
    return Array.isArray(history) ? history : [];
  } catch (error) {
    storage.removeItem(key);
    return [];
  }
}
