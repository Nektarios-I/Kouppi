import { defineConfig, devices } from "@playwright/test";

const webPort = process.env.PLAYWRIGHT_WEB_PORT ?? "3000";
const webUrl = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${webPort}`;

/**
 * Minimal Playwright smoke config.
 * Starts the Next.js web app only. Full Career/MP E2E still needs the game server.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: webUrl,
    trace: "on-first-retry",
  },
  webServer: {
    command: `pnpm exec next dev -H 127.0.0.1 -p ${webPort}`,
    url: webUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
