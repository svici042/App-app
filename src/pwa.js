/**
 * PWA and native sharing helpers.
 *
 * Uses Capacitor plugins on native platforms and browser APIs on the web.
 */

/**
 * Shares text through native share, Web Share, or clipboard fallback.
 *
 * @param {string} title Share title.
 * @param {string} text Text payload.
 * @returns {Promise<boolean>} True when an explicit share sheet was used.
 */
export async function shareText(title, text) {
  const capacitor = globalThis.Capacitor;
  if (capacitor?.isNativePlatform?.()) {
    try {
      const module = await import("@capacitor/share");
      await module.Share.share({ title, text });
      return true;
    } catch (error) {
      return false;
    }
  }

  if (navigator.share) {
    await navigator.share({ title, text });
    return true;
  }

  await navigator.clipboard?.writeText(text);
  return false;
}

/**
 * Writes a text file through Capacitor Filesystem on native builds.
 *
 * Browser builds return false because there is no native document directory.
 *
 * @param {string} fileName Destination file name.
 * @param {string} text File contents.
 * @returns {Promise<boolean>} True when the file was written.
 */
export async function writeTextFile(fileName, text) {
  const capacitor = globalThis.Capacitor;
  if (!capacitor?.isNativePlatform?.()) return false;

  try {
    const module = await import("@capacitor/filesystem");
    await module.Filesystem.writeFile({
      path: fileName,
      data: text,
      directory: module.Directory.Documents,
      recursive: true,
    });
    return true;
  } catch (error) {
    return false;
  }
}
