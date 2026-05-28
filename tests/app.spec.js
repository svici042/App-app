import { expect, test } from "@playwright/test";

test("loads the map shell and PWA metadata", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("h1")).toHaveText("Marine Navigator");
  await expect(page.locator("#map")).toBeVisible();
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
