import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.js",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  webServer: [
    {
      command: "npm run proxy",
      url: "http://localhost:8787/api/health",
      reuseExistingServer: true,
      timeout: 15_000,
    },
    {
      command: "npm run dev",
      url: "https://localhost:5173",
      reuseExistingServer: true,
      timeout: 20_000,
      ignoreHTTPSErrors: true,
    },
  ],
  use: {
    baseURL: "https://localhost:5173",
    ignoreHTTPSErrors: true,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
