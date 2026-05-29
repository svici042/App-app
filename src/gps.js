/**
 * GPS integration helpers.
 *
 * Bridges browser code to Capacitor Geolocation when running as a native app
 * and keeps speed-unit formatting isolated from the main UI controller.
 */

const GPS_WATCH_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 2000,
  minimumUpdateInterval: 3000,
  interval: 3000,
};

/**
 * Checks whether the app is running inside a Capacitor native shell.
 *
 * @returns {boolean} True on native Android/iOS.
 */
export function isNativePlatform() {
  return Boolean(globalThis.Capacitor?.isNativePlatform?.());
}

/**
 * Loads the Capacitor Geolocation plugin only on native platforms.
 *
 * @returns {Promise<import("@capacitor/geolocation").GeolocationPlugin|null>} Plugin instance.
 */
async function getNativeGeolocation() {
  if (!isNativePlatform()) return null;

  const module = await import("@capacitor/geolocation");
  return module.Geolocation;
}

/**
 * Requests a one-shot native position from Capacitor when available.
 *
 * Browser builds return `null` so the caller can fall back to `navigator.geolocation`.
 *
 * @returns {Promise<GeolocationPosition|null>} Native geolocation result or null.
 */
export async function getNativePosition() {
  try {
    const geolocation = await getNativeGeolocation();
    if (!geolocation) return null;

    return geolocation.getCurrentPosition(GPS_WATCH_OPTIONS);
  } catch (error) {
    return null;
  }
}

/**
 * Requests native location permission when Capacitor is available.
 *
 * @returns {Promise<import("@capacitor/geolocation").PermissionStatus|null>} Permission status.
 */
export async function requestNativeLocationPermission() {
  const geolocation = await getNativeGeolocation();
  if (!geolocation) return null;

  const currentStatus = await geolocation.checkPermissions();
  if (currentStatus.location === "granted" || currentStatus.coarseLocation === "granted") {
    return currentStatus;
  }

  return geolocation.requestPermissions({ permissions: ["location"] });
}

/**
 * Starts a native high-accuracy GPS watch through Capacitor.
 *
 * @param {(position: import("@capacitor/geolocation").Position) => void} onPosition Position callback.
 * @param {(error: Error) => void} onError Error callback.
 * @returns {Promise<string|null>} Native watch id or null when not native.
 */
export async function startNativePositionWatch(onPosition, onError) {
  const geolocation = await getNativeGeolocation();
  if (!geolocation) return null;

  return geolocation.watchPosition(GPS_WATCH_OPTIONS, (position, error) => {
    if (error) {
      onError(error);
      return;
    }
    if (position?.coords) onPosition(position);
  });
}

/**
 * Clears a native Capacitor GPS watch.
 *
 * @param {string|null} watchId Native watch id.
 * @returns {Promise<void>}
 */
export async function clearNativePositionWatch(watchId) {
  const geolocation = await getNativeGeolocation();
  if (!geolocation || !watchId) return;

  await geolocation.clearWatch({ id: watchId });
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

export { GPS_WATCH_OPTIONS };
