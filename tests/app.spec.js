import { expect, test } from "@playwright/test";

test("loads the map shell and PWA metadata", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("h1")).toHaveText("Marine Navigator");
  await expect(page.locator("#map")).toBeVisible();
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "manifest.json",
  );
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

test("language switch updates labels", async ({ page }) => {
  await page.goto("/");

  await page.locator("#lang-toggle").click();
  await expect(page.getByRole("button", { name: "Navigation" })).toBeVisible();
  await expect(page.locator("#orientation-toggle")).toContainText("North");
});

test("offline panel exposes area download controls", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Išsaugotas vaizdas" }).click();
  await expect(page.locator("#offline-min-zoom")).toBeVisible();
  await expect(page.locator("#offline-max-zoom")).toBeVisible();
  await expect(page.locator("#offline-progress")).toBeVisible();
});
