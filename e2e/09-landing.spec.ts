import { expect, test } from "@playwright/test";

// The public home page: 3D globe (or a still picture), flip cards, the demo link, and a public feed without IPs.
const SHOTS = process.env.SHOT_DIR;

test("the home page shows the globe, the six rules as flip cards, and links to the demo", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("two live websites");
  await expect(page.getByRole("img", { name: /^Globe:/ })).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1); // WebGL globe, loaded on demand
  await expect(page.getByText("Simulated attacks")).toBeVisible(); // no real country data in the test database
  await expect(page.getByText(/blocked while you watched/)).toContainText(/[1-9]/, { timeout: 15_000 });

  // Flip cards are buttons: keyboard users turn them over with Enter.
  const card = page.getByRole("button", { name: /^Brute force:/ });
  await card.focus();
  await page.keyboard.press("Enter");
  await expect(card).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /: show how it's detected$/ })).toHaveCount(5);

  if (SHOTS) await page.screenshot({ path: `${SHOTS}/landing.png`, fullPage: true });
  await page.getByRole("link", { name: "Try the demo" }).click();
  await expect(page).toHaveURL(/\/demo$/, { timeout: 30_000 }); // dev mode compiles /demo on first visit
});

test("with reduced motion there's a still picture and no WebGL", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByRole("img", { name: /^Globe:/ })).toBeVisible();
  await expect(page.getByText("Simulated attacks")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  await context.close();
});

test("on a phone the page fits the screen (no sideways scrolling)", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByRole("img", { name: /^Globe:/ })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  if (SHOTS) {
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SHOTS}/landing-phone.png` });
  }
  await context.close();
});

test("the public feed has country totals only: no IPs, accounts or paths", async ({ request }) => {
  const response = await request.get("/api/public/attacks");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("max-age=60");
  const text = await response.text();
  expect(text).not.toMatch(/\d+\.\d+\.\d+\.\d+/); // no IPv4 address anywhere
  expect(Object.keys(JSON.parse(text)).sort()).toEqual(["countries", "highAlerts", "mode", "total"]);
});
