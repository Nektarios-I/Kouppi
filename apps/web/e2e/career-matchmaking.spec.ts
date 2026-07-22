import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

const API_URL = process.env.PLAYWRIGHT_SERVER_URL ?? "http://127.0.0.1:4000";
const PASSWORD = "password123";

type RegisteredUser = {
  token: string;
  user: Record<string, unknown>;
};

async function registerCareerUser(page: Page, suffix: string): Promise<RegisteredUser> {
  const unique = Math.random().toString(36).slice(2, 8);
  const username = `e2e_${unique}_${suffix}`.slice(0, 20);
  const response = await page.request.post(`${API_URL}/api/auth/register`, {
    data: { username, password: PASSWORD },
  });
  const responseText = await response.text();
  expect(response.ok(), `register ${username}: HTTP ${response.status()} ${responseText}`).toBe(true);
  const body = JSON.parse(responseText) as RegisteredUser & { success: boolean };
  expect(body.success).toBe(true);
  return body;
}

async function authenticatedCareerPage(
  browser: Browser,
  suffix: string
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const auth = await registerCareerUser(page, suffix);
  await context.addInitScript((value) => {
    localStorage.setItem(
      "kouppi-auth",
      JSON.stringify({ state: { token: value.token, user: value.user }, version: 0 })
    );
    localStorage.setItem("kouppi_conduct_accepted_v1", "1");
  }, auth);
  await page.goto("/career");
  await expect(page.getByText("Select a League", { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /Bronze League/i }).click();
  await expect(page.getByRole("button", { name: "Create Waiting Table" }).first()).toBeVisible();
  return { context, page };
}

test.describe("Career matchmaking navigation", () => {
  test("Create Waiting Table navigates to its dedicated configured table page", async ({ browser }) => {
    const player = await authenticatedCareerPage(browser, "create");
    try {
      await player.page.getByRole("button", { name: "Create Waiting Table" }).first().click();

      await expect(player.page).toHaveURL(/\/career\/table\/career-[a-f0-9-]+$/, {
        timeout: 15_000,
      });
      await expect(player.page.getByText("Waiting table · Ante: 5 · Bet: 5–25")).toBeVisible();
      await expect(player.page.getByText("1/2", { exact: true })).toBeVisible();
      await expect(player.page.getByText(/Waiting for an opponent/i)).toBeVisible();

      const tableUrl = player.page.url();
      await player.page.reload();
      await expect(player.page).toHaveURL(tableUrl);
      await expect(player.page.getByText("Waiting table · Ante: 5 · Bet: 5–25")).toBeVisible({
        timeout: 15_000,
      });
      await expect(player.page.getByText("1/2", { exact: true })).toBeVisible();
    } finally {
      await player.context.close();
    }
  });

  test("two Quick Match players navigate to the same configured table page", async ({ browser }) => {
    const playerA = await authenticatedCareerPage(browser, "quick_a");
    const playerB = await authenticatedCareerPage(browser, "quick_b");
    try {
      await Promise.all([
        playerA.page.getByRole("button", { name: "Quick Match" }).first().click(),
        playerB.page.getByRole("button", { name: "Quick Match" }).first().click(),
      ]);

      await Promise.all([
        expect(playerA.page).toHaveURL(/\/career\/table\/career-[a-f0-9-]+$/, {
          timeout: 20_000,
        }),
        expect(playerB.page).toHaveURL(/\/career\/table\/career-[a-f0-9-]+$/, {
          timeout: 20_000,
        }),
      ]);

      expect(playerA.page.url()).toBe(playerB.page.url());
      await Promise.all([
        expect(playerA.page.getByText("2/2", { exact: true })).toBeVisible(),
        expect(playerB.page.getByText("2/2", { exact: true })).toBeVisible(),
        expect(playerA.page.getByText("Waiting table · Ante: 5 · Bet: 5–25")).toBeVisible(),
        expect(playerB.page.getByText("Waiting table · Ante: 5 · Bet: 5–25")).toBeVisible(),
      ]);
      await expect(playerA.page.getByRole("button", { name: "Ready", exact: true })).toBeVisible();
      await expect(playerB.page.getByRole("button", { name: "Ready", exact: true })).toBeVisible();
    } finally {
      await Promise.all([playerA.context.close(), playerB.context.close()]);
    }
  });
});
