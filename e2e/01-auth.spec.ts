import { expect, test, type Page } from "@playwright/test";
import { base32Decode, currentStep, hotp } from "../lib/auth/totp";
import { E2E_ADMIN, E2E_URL } from "./fixtures";

// One story, in order: the tests share the one account (2FA gets set up in the second test).
test.describe.configure({ mode: "serial" });

let totpSecret = "";
let lastUsedStep = 0;

/** A code GuardRail hasn't accepted yet: the current or next 30-second step, never one already used. */
async function freshCode(page: Page): Promise<string> {
  for (;;) {
    const now = currentStep(Date.now());
    const step = [now, now + 1].find((s) => s > lastUsedStep);
    if (step !== undefined) {
      lastUsedStep = step;
      return hotp(base32Decode(totpSecret), step);
    }
    await page.waitForTimeout(1000); // both used: wait for the clock to move on
  }
}

async function enterPassword(page: Page, password = E2E_ADMIN.password) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(E2E_ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Continue" }).click();
}

async function signInFully(page: Page) {
  await enterPassword(page);
  await page.getByLabel("6-digit code").fill(await freshCode(page));
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
}

test("the dashboard needs sign-in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("first sign-in forces 2FA setup, then opens the dashboard", async ({ page }) => {
  await enterPassword(page);
  await expect(page).toHaveURL(/\/setup-2fa$/);
  await expect(page.getByRole("img", { name: /QR code/ })).toBeVisible();

  totpSecret = (await page.getByTestId("totp-key").innerText()).replace(/\s/g, "");
  expect(totpSecret).toMatch(/^[A-Z2-7]{32}$/);

  await page.getByLabel("6-digit code").fill(await freshCode(page));
  await page.getByRole("button", { name: "Turn on 2FA" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByText(E2E_ADMIN.email).first()).toBeVisible();
});

test("sign out, then sign in with password + code; a used code is refused", async ({ page }) => {
  await signInFully(page);
  const usedCode = hotp(base32Decode(totpSecret), lastUsedStep);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/signin$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/signin$/);

  // The same code again: refused (replay protection), even though it's still inside its 30 seconds.
  await enterPassword(page);
  await page.getByLabel("6-digit code").fill(usedCode);
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await expect(page.locator("#signin-error")).toContainText("That code isn't right");
});

test("phone menu works with the keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await signInFully(page);

  const openMenu = page.getByRole("button", { name: "Open menu" });
  const menu = page.getByRole("dialog", { name: "Menu" });
  await openMenu.click();
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(openMenu).toBeFocused(); // focus goes back to the button

  await openMenu.click();
  await menu.getByRole("link", { name: "Events" }).click();
  await expect(page.getByRole("heading", { name: "Events" })).toBeVisible();
  await expect(menu).toBeHidden();
});

test("pages send security headers with a fresh CSP nonce", async ({ request }) => {
  const first = await request.get("/signin");
  const second = await request.get("/signin");
  const csp = first.headers()["content-security-policy"] ?? "";
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
  expect(second.headers()["content-security-policy"]).not.toBe(csp); // a new nonce every request
  expect(first.headers()["x-content-type-options"]).toBe("nosniff");
  expect(first.headers()["x-frame-options"]).toBe("DENY");
});

test("the API refuses requests from another site (CSRF)", async ({ request }) => {
  const evil = await request.post("/api/auth/signin", {
    headers: { Origin: "https://evil.example" },
    data: { email: E2E_ADMIN.email, password: E2E_ADMIN.password },
  });
  expect(evil.status()).toBe(403);
  const sameSite = await request.post("/api/auth/signin", {
    headers: { Origin: E2E_URL },
    data: { email: E2E_ADMIN.email, password: "wrong-password-123" },
  });
  expect(sameSite.status()).toBe(401);
});
