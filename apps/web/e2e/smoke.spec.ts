import { test, expect } from "@playwright/test";

test.describe("KOUPPI smoke E2E", () => {
  test("homepage loads with Single Player entry", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /single player/i }).first()).toBeVisible();
  });

  test("Single Player shows configuration dialog on entry (E2E1 smoke)", async ({ page }) => {
    await page.goto("/play/single");
    // Settings dialog should appear for a fresh session
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
  });

  test("Career page opens auth UI (E2E3 smoke — no live server required for modal)", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("kouppi_conduct_accepted_v1", "1");
    });
    await page.goto("/career");
    const signIn = page.getByRole("button", { name: /sign in/i }).first();
    await expect(signIn).toBeVisible({ timeout: 15_000 });
    await signIn.click();
    await expect(page.getByRole("heading", { name: /welcome back|create account/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /show password/i })).toBeVisible();
  });
});
