import { cp, mkdir } from "node:fs/promises";

const copies = [
  ["app.js", "dist/app.js"],
  ["service-worker.js", "dist/service-worker.js"],
  ["manifest.json", "dist/manifest.json"],
  ["vendor", "dist/vendor"],
  ["media/icons", "dist/media/icons"],
  ["media/logo", "dist/media/logo"],
];

await mkdir("dist", { recursive: true });

for (const [from, to] of copies) {
  await cp(from, to, { recursive: true, force: true });
}

console.log("Static runtime files copied to dist.");
