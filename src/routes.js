// LT: Haversine formulė skaičiuoja atstumą tarp dviejų koordinačių kilometrais. / EN: The Haversine formula calculates distance between two coordinates in kilometers.
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

// LT: Apskaičiuoja kryptį laipsniais nuo pirmo taško iki antro. / EN: Calculates bearing in degrees from the first point to the second.
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

// LT: Saugiai perskaito maršrutų istoriją, net jei localStorage įrašas sugadintas. / EN: Safely reads route history even if the localStorage entry is corrupted.
export function readRouteHistory(storage, key) {
  try {
    const history = JSON.parse(storage.getItem(key) || "[]");
    return Array.isArray(history) ? history : [];
  } catch (error) {
    storage.removeItem(key);
    return [];
  }
}
