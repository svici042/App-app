/**
 * GPS integration helpers.
 *
 * Bridges browser code to Capacitor Geolocation when running as a native app
 * and keeps speed-unit formatting isolated from the main UI controller.
 */

/**
 * Requests a one-shot native position from Capacitor when available.
 *
 * Browser builds return `null` so the caller can fall back to `navigator.geolocation`.
 *
 * @returns {Promise<GeolocationPosition|null>} Native geolocation result or null.
 */
export async function getNativePosition() {
  const capacitor = globalThis.Capacitor;
  if (!capacitor?.isNativePlatform?.()) return null;

  try {
    const module = await import("@capacitor/geolocation");
    return module.Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
    });
  } catch (error) {
    return null;
  }
}

/**
 * Converts speed from meters per second to knots for marine UI display.
 *
 * @param {number|null|undefined} speed Speed in meters per second.
 * @returns {string} Knots with one decimal place, or `--` when unavailable.
 */
export function metersPerSecondToKnots(speed) {
  return typeof speed === "number" ? (speed * 1.94384).toFixed(1) : "--";
}
