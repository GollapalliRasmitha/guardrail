import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN } from "./fixtures";

async function enterPassword(page: Page, password: string) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(E2E_ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Continue" }).click();
}

// Last on purpose: it locks sign-in from this computer for 15 minutes (the next run resets the database).
test("five wrong passwords lock sign-in, even for the right password", async ({ page }) => {
  // One wrong try already happened in the CSRF test (01-auth); 4 more reach the limit of 5.
  for (let i = 0; i < 4; i++) {
    await enterPassword(page, `wrong-password-${i}-xyz`);
    await expect(page.locator("#signin-error")).toContainText("Email or password is wrong");
  }
  await enterPassword(page, E2E_ADMIN.password);
  await expect(page.locator("#signin-error")).toContainText("Too many tries");
});
