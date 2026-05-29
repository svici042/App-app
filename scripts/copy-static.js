import { cp, mkdir } from "node:fs/promises";

/**
 * Copies static runtime assets into Vite's `dist` folder after a production build.
 *
 * Vite processes module assets, while the service worker, web manifest, icons,
 * and logo need to remain available at stable public paths.
 */
const copies = [
  ["service-worker.js", "dist/service-worker.js"],
  ["manifest.json", "dist/manifest.json"],
  ["media/icons", "dist/media/icons"],
  ["media/logo", "dist/media/logo"],
];

await mkdir("dist", { recursive: true });

for (const [from, to] of copies) {
  await cp(from, to, { recursive: true, force: true });
}

console.log("Static runtime files copied to dist.");
