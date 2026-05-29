import { expect, test } from "@playwright/test";

test("loads the map shell and PWA metadata", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("h1")).toHaveText("Marine Navigator");
  await expect(page.locator("#map")).toBeVisible();
  await expect(page.locator("#depth-status")).toHaveText(/Depth/);
  await expect(page.locator("#depth-debug")).toContainText("Provider: EMODnet Bathymetry");
  await expect(page.locator("#depth-debug")).toContainText("Center:");
  await expect(page.locator("#depth-debug")).toContainText("Zoom:");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "manifest.json",
  );
  await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute(
    "content",
    "yes",
  );
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveCount(0);
});

test("opens navigation menu and toggles route tools", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Navigacija" }).click();
  await expect(page.locator("#tab-navigation")).toBeVisible();

  await page.locator("#waypoint-mode-btn").click();
  await expect(page.locator("#waypoint-mode-btn")).toContainText("Pasirinkite");

  await page.locator("#measure-mode-btn").click();
  await expect(page.locator("#measure-mode-btn")).toContainText("Pasirinkite");
});

test("keeps controls usable after GPS start fails", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        clearWatch: () => {},
        watchPosition: (_success, error) => {
          setTimeout(() => error({ message: "Permission denied" }), 0);
          return 7;
        },
      },
    });
  });

  await page.goto("/");

  await page.getByRole("button", { name: "Navigacija" }).click();
  await page.locator("#gps-start").click();
  await expect(page.locator("#gps-start")).toContainText("Paleisti GPS");

  await page.getByRole("button", { name: "Žemėlapiai" }).click();
  await expect(page.locator("#tab-charts")).toBeVisible();
  await page.getByRole("button", { name: "Nustatymai" }).click();
  await expect(page.locator("#tab-settings")).toBeVisible();
});

test("closes the menu without leaving focus inside hidden content", async ({ page }) => {
  const ariaWarnings = [];
  page.on("console", (message) => {
    if (message.type() === "warning" && message.text().includes("aria-hidden")) {
      ariaWarnings.push(message.text());
    }
  });

  await page.goto("/");

  await page.getByRole("button", { name: "Navigacija" }).click();
  await expect(page.locator("#menu-window")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator("#menu-window")).not.toHaveAttribute("inert", "");
  await expect(page.locator("#close-menu")).toBeFocused();

  await page.locator("#close-menu").click();

  await expect(page.locator("#menu-window")).toHaveClass(/hidden/);
  await expect(page.locator("#menu-window")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator("#menu-window")).toHaveAttribute("inert", "");
  await expect(page.getByRole("button", { name: "Navigacija" })).toBeFocused();
  expect(ariaWarnings).toEqual([]);
});

test("language switch updates labels", async ({ page }) => {
  await page.goto("/");

  await page.locator("#lang-toggle").click();
  await expect(page.getByRole("button", { name: "Navigation" })).toBeVisible();
  await expect(page.locator("#orientation-toggle")).toContainText("North");
});

test("offline panel exposes area download controls", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Išsaugotas vaizdas" }).click();
  await expect(page.locator("#offline-area-name")).toBeVisible();
  await expect(page.locator("#offline-area-list")).toBeVisible();
  await expect(page.locator("#offline-min-zoom")).toBeVisible();
  await expect(page.locator("#offline-max-zoom")).toBeVisible();
  await expect(page.locator("#delete-offline")).toBeVisible();
  await expect(page.locator("#offline-progress")).toBeVisible();
});

test("charts panel exposes provider health status", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Žemėlapiai" }).click();
  await expect(page.locator("#depth-safety-note")).toHaveText(
    "Depth data is for reference only. Not for primary navigation.",
  );
  await expect(page.locator("#primary-depth-source")).toHaveText(
    "Primary depth source: EMODnet",
  );
  await expect(page.locator("#provider-health-status")).toBeVisible();
  await expect(page.locator("#provider-health-list")).toBeVisible();
});

test("shows provider metadata registry in the layer status UI", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Žemėlapiai" }).click();
  const metadata = page.locator("#provider-metadata-list");
  await expect(metadata).toContainText("OpenStreetMap: tile · base map");
  await expect(metadata).toContainText("Esri World Imagery: tile · satellite imagery");
  await expect(metadata).toContainText("Esri World Topo Map: tile · terrain/topographic base map");
  await expect(metadata).toContainText("EMODnet Bathymetry: wms · bathymetry depth soundings and contours");
  await expect(metadata).toContainText("GEBCO relief: wms · visual seabed relief");
  await expect(metadata).toContainText("safety referenceOnly");
  await expect(metadata).toContainText("safety visualOnly");
  await expect(metadata).not.toContainText("certified");
});

test("shows fallback bathymetry availability and quality warning", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Žemėlapiai" }).click();
  await expect(page.locator("#fallback-depth-status")).toHaveText(
    "Approximate seabed relief: available",
  );
  await expect(page.locator("#fallback-depth-quality")).toHaveText(
    "Relief layer is low-resolution visual bathymetry, not safe depth data.",
  );
  await expect(
    page.getByRole("button", { name: "Use approximate seabed relief" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Experimental 3D seabed" })).toBeDisabled();
});

test("fallback bathymetry is selected only after explicit user choice", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Žemėlapiai" }).click();
  await expect(page.locator("#fallback-depth-status")).toHaveText(
    "Approximate seabed relief: available",
  );
  await page.getByRole("button", { name: "Use approximate seabed relief" }).click();
  await expect(page.locator("#fallback-depth-status")).toHaveText(
    "Approximate seabed relief: available · selected",
  );
  await expect(page.getByRole("button", { name: "Experimental 3D seabed" })).toBeDisabled();
});

test("shows depth provider failure instead of silently hiding depth data", async ({ page }) => {
  const debugMessages = [];
  page.on("console", (message) => {
    if (message.type() === "debug") debugMessages.push(message.text());
  });
  await page.route("https://ows.emodnet-bathymetry.eu/wms**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "image/png",
      body: "",
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    }),
  );

  await page.goto("/");

  await expect(page.locator("#depth-status")).toHaveText(
    "No numeric depth data available here. Approximate seabed relief may still be available.",
  );
  await expect(page.locator("#primary-depth-source")).toHaveText(
    "Primary depth source: EMODnet",
  );
  await expect(page.locator("#depth-debug")).toContainText("Depth provider failed");
  await expect(page.locator("#depth-debug")).toContainText("Request: failed");
  await expect(page.locator("#depth-debug")).toContainText("Status: HTTP 503");
  await expect(page.locator("#map-footer")).toContainText(
    "Nepavyko užkrauti vieno iš batimetrijos sluoksnių",
  );
  await expect.poll(() => debugMessages.some((text) => text.includes("Depth WMS tile URL:")))
    .toBe(true);
});

test("shows depth offline gap outside saved areas", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      get: () => false,
    });
    localStorage.removeItem("marine-navigator-offline-areas");
    localStorage.removeItem("marine-navigator-offline");
  });

  await page.goto("/");

  await expect(page.locator("#depth-status")).toHaveText(
    "Depth data not available offline for this area.",
  );
});
