import { expect, test, type Page } from "@playwright/test";
import { sendSigned, signInAsAdmin, testEvent } from "./helpers";

// One signed-in browser for all tests in this file (each new sign-in would have to wait for a fresh 2FA code).
test.describe.configure({ mode: "serial" });
let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  await signInAsAdmin(page);
});

test.afterAll(async () => {
  await page.context().close();
});

const liveDot = () => page.getByRole("status").filter({ hasText: /^Live$/ });

test("a new event appears on the Events page live, without reloading", async ({ request }) => {
  await page.goto("/dashboard/events");
  await expect(liveDot()).toBeVisible();

  const marker = `/live-test-${Date.now()}`;
  const { response } = await sendSigned(request, [testEvent({ type: "suspicious_path", path: marker })]);
  expect(response.status()).toBe(202);

  // The row arrives through the Server-Sent Events stream (the server checks every 2 s).
  await expect(page.getByRole("table").getByText(marker)).toBeVisible({ timeout: 10_000 });
});

test("live events respect the page's filters", async ({ request }) => {
  await page.goto("/dashboard/events?type=suspicious_path");
  await expect(liveDot()).toBeVisible();

  const hidden = `/should-not-show-${Date.now()}`;
  const shown = `/should-show-${Date.now()}`;
  await sendSigned(request, [testEvent({ type: "login_failed", path: hidden })]);
  await sendSigned(request, [testEvent({ type: "suspicious_path", path: shown })]);

  await expect(page.getByRole("table").getByText(shown)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(hidden)).toHaveCount(0);
});

test("filters, search and pages work from the URL", async ({ request }) => {
  // 30 more events so there are at least 2 pages of 25.
  const batch = Array.from({ length: 30 }, (_, i) => testEvent({ ip: `198.51.100.${i + 1}` }));
  expect((await sendSigned(request, batch, { source: "oppora" })).response.status()).toBe(202);

  await page.goto("/dashboard/events");
  await expect(page.getByText(/Page 1 of \d+/)).toBeVisible();
  await page.getByRole("link", { name: "Older" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText(/Page 2 of \d+/)).toBeVisible();

  // Search by IP using the form (a plain GET form: the filters end up in the URL).
  await page.goto("/dashboard/events");
  await page.getByLabel("Search IP, account or path").fill("198.51.100.7");
  await page.getByRole("button", { name: "Filter" }).click();
  await expect(page).toHaveURL(/q=198\.51\.100\.7/);
  const table = page.getByRole("table");
  await expect(table.getByText("198.51.100.7", { exact: true })).toBeVisible();
  await expect(table.getByText("198.51.100.8", { exact: true })).toHaveCount(0);

  // Filter by source.
  await page.goto("/dashboard/events?source=homehaat");
  await expect(page.getByRole("table").getByText("Oppora")).toHaveCount(0);
});

test("the Overview counts real events and shows both sources online", async () => {
  await page.goto("/dashboard");
  const sources = page.getByRole("region", { name: "Sources" });
  await expect(sources.getByText("Online")).toHaveCount(2);
  await expect(page.getByText("2 / 2")).toBeVisible();
});

test("the live feed pauses while the tab is hidden", async () => {
  await page.goto("/dashboard");
  await expect(liveDot()).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByRole("status").filter({ hasText: "Paused" })).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(liveDot()).toBeVisible();
});
