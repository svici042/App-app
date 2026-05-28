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
