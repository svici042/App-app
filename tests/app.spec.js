import { expect, test } from "@playwright/test";

async function openSidebarIfCollapsed(page) {
  if ((await page.locator("body.sidebar-collapsed").count()) > 0) {
    await page.locator("#open-sidebar").click();
  }
}

function boxesOverlap(a, b) {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

async function expectMenuBelowOrientationControls(page) {
  const menuBox = await page.locator("#open-sidebar").boundingBox();
  const controlBoxes = [];
  for (const selector of ["#orientation-toggle", "#heading-toggle", "#follow-toggle"]) {
    const box = await page.locator(selector).boundingBox();
    expect(box).not.toBeNull();
    controlBoxes.push(box);
  }
  expect(menuBox).not.toBeNull();
  for (const box of controlBoxes) {
    expect(boxesOverlap(menuBox, box)).toBe(false);
  }
  expect(menuBox.y).toBeGreaterThanOrEqual(
    Math.max(...controlBoxes.map((box) => box.y + box.height)) - 1,
  );
}

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
  await openSidebarIfCollapsed(page);

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
  await openSidebarIfCollapsed(page);

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
  await openSidebarIfCollapsed(page);

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
  await openSidebarIfCollapsed(page);

  await page.locator("#lang-toggle").click();
  await expect(page.getByRole("button", { name: "Navigation" })).toBeVisible();
  await expect(page.locator("#orientation-toggle")).toContainText("North");
});

test("sidebar can collapse and reopen without hiding the map", async ({ page }) => {
  await page.goto("/");
  await openSidebarIfCollapsed(page);

  await expect(page.locator("#app-sidebar")).toBeVisible();
  await page.locator("#collapse-sidebar").click();
  await expect(page.locator("body")).toHaveClass(/sidebar-collapsed/);
  await expect(page.locator("#open-sidebar")).toBeVisible();
  await expect(page.locator("#map")).toBeVisible();

  await page.locator("#open-sidebar").click();
  await expect(page.locator("body")).not.toHaveClass(/sidebar-collapsed/);
  await expect(page.locator("#app-sidebar")).toBeVisible();
});

test("depth diagnostics panel can collapse to a status chip and reopen", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("body")).toHaveClass(/depth-panel-collapsed/);
  await expect(page.locator("#depth-chip")).toBeVisible();
  await expect(page.locator("#depth-chip")).toHaveText(/Depths (online|offline|unavailable)/);
  await expect(page.locator("#depth-debug")).toBeHidden();

  await page.locator("#depth-chip").click();
  await expect(page.locator("body")).not.toHaveClass(/depth-panel-collapsed/);
  await expect(page.locator("#depth-debug")).toBeVisible();
});

test("depth legend is compact by default and does not block the map", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("body")).toHaveClass(/depth-legend-collapsed/);
  await expect(page.locator("#toggle-depth-legend")).toBeVisible();
  await expect(page.locator("#depth-legend-content")).toBeHidden();

  const legendBox = await page.locator(".depth-legend").boundingBox();
  const mapBox = await page.locator("#map").boundingBox();
  expect(legendBox?.width).toBeLessThan(120);
  expect(legendBox?.height).toBeLessThan(60);
  expect(mapBox?.width).toBeGreaterThan(300);
});

test("mobile sidebar starts as a drawer and closes when tapping outside", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.locator("body")).toHaveClass(/sidebar-collapsed/);
  await expect(page.locator("#open-sidebar")).toBeVisible();
  const mapBox = await page.locator("#map").boundingBox();
  expect(mapBox?.width).toBeGreaterThan(300);

  await page.locator("#open-sidebar").click();
  await expect(page.locator("body")).toHaveClass(/sidebar-drawer-open/);
  await page.locator("#sidebar-backdrop").click({ position: { x: 380, y: 20 } });
  await expect(page.locator("body")).not.toHaveClass(/sidebar-drawer-open/);
  await expect(page.locator("body")).toHaveClass(/sidebar-collapsed/);
  await expect(page.locator("#map")).toBeVisible();
});

test("mobile menu and compass controls do not overlap", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expectMenuBelowOrientationControls(page);
});

test("mobile landscape menu and orientation controls do not overlap", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/");

  await expectMenuBelowOrientationControls(page);
});

test("desktop menu and compass controls do not overlap when sidebar is collapsed", async ({ page }) => {
  await page.goto("/");
  await openSidebarIfCollapsed(page);
  await page.locator("#collapse-sidebar").click();

  await expectMenuBelowOrientationControls(page);
});

test("desktop menu and compass controls do not overlap", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only control state");
  await page.goto("/");

  const compassBox = await page.locator("#orientation-toggle").boundingBox();
  expect(compassBox).not.toBeNull();
  await expect(page.locator("#open-sidebar")).toBeHidden();
});

test("North button resets map bearing to zero", async ({ page }) => {
  await page.goto("/");

  await page.evaluate(() => window.__marineNavigator.map.setBearing(73));
  await expect
    .poll(() => page.evaluate(() => window.__marineNavigator.map.getBearing()))
    .toBe(73);

  await page.locator("#orientation-toggle").click();

  await expect
    .poll(() => page.evaluate(() => window.__marineNavigator.map.getBearing()))
    .toBe(0);
  await expect(page.locator("#orientation-toggle")).toHaveAttribute("aria-pressed", "true");
});

test("heading and follow mode keep user marker visible", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        clearWatch: () => {},
        watchPosition: (success) => {
          setTimeout(
            () =>
              success({
                coords: {
                  latitude: 55.7,
                  longitude: 21.1,
                  accuracy: 8,
                  speed: 4,
                  heading: 82,
                },
              }),
            0,
          );
          return 11;
        },
      },
    });
  });

  await page.goto("/");
  await openSidebarIfCollapsed(page);
  await page.getByRole("button", { name: "Navigacija" }).click();
  await page.locator("#gps-start").click();
  await page.locator("#close-menu").click();
  if ((await page.locator("body.sidebar-drawer-open").count()) > 0) {
    await page.locator("#collapse-sidebar").click();
  }
  await page.locator("#follow-toggle").click();

  await expect
    .poll(() => page.evaluate(() => window.__marineNavigator.orientationMode))
    .toBe("follow");
  await expect
    .poll(() => page.evaluate(() => Math.round(window.__marineNavigator.map.getBearing())))
    .toBe(82);

  const markerBox = await page.locator(".leaflet-interactive").first().boundingBox();
  const mapBox = await page.locator("#map").boundingBox();
  expect(markerBox).not.toBeNull();
  expect(mapBox).not.toBeNull();
  expect(markerBox.x).toBeGreaterThanOrEqual(mapBox.x);
  expect(markerBox.y).toBeGreaterThanOrEqual(mapBox.y);
  expect(markerBox.x).toBeLessThanOrEqual(mapBox.x + mapBox.width);
  expect(markerBox.y).toBeLessThanOrEqual(mapBox.y + mapBox.height);
});

test("WMS layers redraw after zoom, pan, and rotation events", async ({ page }) => {
  await page.goto("/");

  await page.evaluate(() => {
    const layer = window.__marineNavigator.layers.contourLayer;
    window.__wmsRedrawCount = 0;
    const originalRedraw = layer.redraw.bind(layer);
    layer.redraw = () => {
      window.__wmsRedrawCount += 1;
      return originalRedraw();
    };
  });

  await page.evaluate(() => window.__marineNavigator.map.fire("zoomend"));
  await page.evaluate(() => window.__marineNavigator.map.fire("moveend"));
  await page.evaluate(() => window.__marineNavigator.map.setBearing(37));

  await expect
    .poll(() => page.evaluate(() => window.__wmsRedrawCount))
    .toBeGreaterThanOrEqual(1);
  const redrawCount = await page.evaluate(() => window.__wmsRedrawCount);
  expect(redrawCount).toBeLessThanOrEqual(2);
});

test("offline panel exposes area download controls", async ({ page }) => {
  await page.goto("/");
  await openSidebarIfCollapsed(page);

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
  await openSidebarIfCollapsed(page);

  await page.getByRole("button", { name: "Žemėlapiai" }).click();
  await expect(page.locator("#depth-safety-note")).toHaveText(
    "Depth data is for reference only. Not for primary navigation.",
  );
  await expect(page.locator("#continuous-depth-status")).toHaveText(/Continuous depth overlays:/);
  await expect(page.locator("#numeric-depth-status")).toHaveText(
    "Numeric depths available by tap/click only in this area.",
  );
  await expect(page.locator("#primary-depth-source")).toHaveText(
    "Primary depth source: EMODnet",
  );
  await expect(page.locator("#provider-health-status")).toBeVisible();
  await expect(page.locator("#provider-health-list")).toBeVisible();
});

test("diagnostics report contour availability when WMS tiles load", async ({ page }) => {
  const transparentPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    "base64",
  );
  await page.route("https://ows.emodnet-bathymetry.eu/wms**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/png",
      body: transparentPng,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    }),
  );

  await page.goto("/");

  await expect(page.locator("#continuous-depth-status")).toHaveText(
    "Continuous depth overlays: contours enabled",
  );
  await expect(page.locator("#depth-debug")).toContainText("Depth layer available here");
});

test("color bathymetry is optional and contours are enabled by default", async ({ page }) => {
  await page.goto("/");

  const overlayStates = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".leaflet-control-layers-overlays label")).map(
      (label) => ({
        text: label.textContent?.trim(),
        checked: Boolean(label.querySelector("input")?.checked),
      }),
    ),
  );

  expect(overlayStates).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ text: "Depth soundings", checked: false }),
      expect.objectContaining({ text: "Depth contours", checked: true }),
      expect.objectContaining({ text: "Experimental visual seabed relief", checked: false }),
    ]),
  );
});

test("broken experimental 3D seabed control is hidden", async ({ page }) => {
  await page.goto("/");
  await openSidebarIfCollapsed(page);

  await page.getByRole("button", { name: "Žemėlapiai" }).click();
  await expect(page.locator("#experimental-3d-toggle")).toBeHidden();
});

test("clicking the map requests and shows numeric EMODnet depth", async ({ page }) => {
  let requestedDepth = false;
  await page.route("**/api/depth?**", (route) => {
    requestedDepth = true;
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ smoothed: -12.34 }),
    });
  });

  await page.goto("/");
  await page.locator("#map").click({ position: { x: 120, y: 220 } });

  await expect(page.locator(".leaflet-popup-content")).toContainText(
    "Realus EMODnet gylis: 12.3 m",
  );
  expect(requestedDepth).toBe(true);
});

test("depth tap query fires once per tap", async ({ page }) => {
  let requestCount = 0;
  await page.route("**/api/depth?**", (route) => {
    requestCount += 1;
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ smoothed: -7.8 }),
    });
  });

  await page.goto("/");
  await page.locator("#map").click({ position: { x: 220, y: 320 } });

  await expect(page.locator(".leaflet-popup-content")).toContainText(
    "Realus EMODnet gylis: 7.8 m",
  );
  expect(requestCount).toBe(1);
});

test("depth query ignores map clicks fired during a gesture", async ({ page }) => {
  let requestCount = 0;
  await page.route("**/api/depth?**", (route) => {
    requestCount += 1;
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ smoothed: -5 }),
    });
  });

  await page.goto("/");
  await page.evaluate(() => {
    const map = window.__marineNavigator.map;
    map.fire("movestart");
    map.fire("click", {
      latlng: map.getCenter(),
      originalEvent: new MouseEvent("click", { bubbles: true }),
    });
    map.fire("moveend");
  });
  await page.waitForTimeout(300);

  expect(requestCount).toBe(0);
  await expect(page.locator(".leaflet-popup-content")).toHaveCount(0);
});

test("newer depth tap result is not overwritten by stale older response", async ({ page }) => {
  let requestCount = 0;
  let firstRoute;
  await page.route("**/api/depth?**", async (route) => {
    requestCount += 1;
    if (requestCount === 1) {
      firstRoute = route;
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ smoothed: -2 }),
    });
    await firstRoute.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ smoothed: -99 }),
    });
  });

  await page.goto("/");
  await page.locator("#map").click({ position: { x: 220, y: 320 } });
  await page.locator("#map").click({ position: { x: 320, y: 360 } });

  const latestPopup = page.locator(".leaflet-popup-content").filter({
    hasText: "Realus EMODnet gylis: 2.0 m",
  });
  await expect(latestPopup).toBeVisible();
  await expect(latestPopup).toContainText(
    "Realus EMODnet gylis: 2.0 m",
  );
  await page.waitForTimeout(150);
  await expect(
    page.locator(".leaflet-popup-content").filter({ hasText: "99.0 m" }),
  ).toHaveCount(0);
});

test("clicking the map reports when numeric depth is unavailable", async ({ page }) => {
  await page.route("**/api/depth?**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    }),
  );

  await page.goto("/");
  await page.locator("#map").click({ position: { x: 120, y: 220 } });

  await expect(page.locator(".leaflet-popup-content")).toHaveText(
    "No numeric depth data available here.",
  );
});

test("clicking the map shows a visible depth provider error", async ({ page }) => {
  await page.route("**/api/depth?**", (route) =>
    route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({ error: "upstream failed" }),
    }),
  );
  await page.route("https://rest.emodnet-bathymetry.eu/depth_sample**", (route) =>
    route.abort(),
  );

  await page.goto("/");
  await page.locator("#map").click({ position: { x: 120, y: 220 } });

  await expect(page.locator(".leaflet-popup-content")).toHaveText(
    "Nepavyko gauti gylio šiame taške.",
  );
});

test("shows provider metadata registry in the layer status UI", async ({ page }) => {
  await page.goto("/");
  await openSidebarIfCollapsed(page);

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

test("shows active depth and relief provider metadata in the data source panel", async ({ page }) => {
  await page.goto("/");
  await openSidebarIfCollapsed(page);

  await page.getByRole("button", { name: "Žemėlapiai" }).click();
  await expect(page.locator("#data-source-title")).toHaveText("Data source / Data origin");
  await expect(page.locator("#data-source-warning")).toHaveText(
    "Depth and bathymetry data are advisory only.",
  );

  const depthProvider = page.locator("#active-depth-provider");
  await expect(depthProvider).toContainText("Depth source: EMODnet Bathymetry");
  await expect(depthProvider).toContainText("bathymetry depth soundings and contours");
  await expect(depthProvider).toContainText("official");
  await expect(depthProvider).toContainText("referenceOnly");
  await expect(depthProvider).toContainText("unknown");
  await expect(depthProvider).toContainText("EMODnet Bathymetry");

  const reliefProvider = page.locator("#relief-provider");
  await expect(reliefProvider).toContainText("Approximate visual relief: GEBCO relief");
  await expect(reliefProvider).toContainText("visual seabed relief");
  await expect(reliefProvider).toContainText("approximate");
  await expect(reliefProvider).toContainText("visualOnly");
  await expect(reliefProvider).not.toContainText("numeric depths");
});

test("shows fallback bathymetry availability and quality warning", async ({ page }) => {
  await page.goto("/");
  await openSidebarIfCollapsed(page);

  await page.getByRole("button", { name: "Žemėlapiai" }).click();
  await expect(page.locator("#fallback-depth-status")).toHaveText(
    "Experimental visual seabed relief: available",
  );
  await expect(page.locator("#fallback-depth-quality")).toHaveText(
    "Relief layer is low-resolution visual bathymetry, not safe depth data.",
  );
  await expect(
    page.getByRole("button", { name: "Use approximate seabed relief" }),
  ).toBeVisible();
  await expect(page.locator("#experimental-3d-toggle")).toBeHidden();
});

test("fallback bathymetry is selected only after explicit user choice", async ({ page }) => {
  await page.goto("/");
  await openSidebarIfCollapsed(page);

  await page.getByRole("button", { name: "Žemėlapiai" }).click();
  await expect(page.locator("#fallback-depth-status")).toHaveText(
    "Experimental visual seabed relief: available",
  );
  await page.getByRole("button", { name: "Use approximate seabed relief" }).click();
  await expect(page.locator("#fallback-depth-status")).toHaveText(
    "Experimental visual seabed relief: available · selected",
  );
  await expect(page.locator("#experimental-3d-toggle")).toBeHidden();
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
    "Depth contours unavailable from current provider in this area.",
  );
  await expect(page.locator("#primary-depth-source")).toHaveText(
    "Primary depth source: EMODnet",
  );
  await expect(page.locator("#depth-debug")).toContainText(
    "Depth contours unavailable from current provider in this area.",
  );
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
