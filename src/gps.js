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

export function metersPerSecondToKnots(speed) {
  return typeof speed === "number" ? (speed * 1.94384).toFixed(1) : "--";
}
