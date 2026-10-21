import { expect, test } from "@playwright/test";
import { sendSigned, signInAsAdmin, testEvent } from "./helpers";

// Overview charts: events per hour (stacked by site, with a table view) and the busiest IPs.
test("Overview charts show events per hour and the busiest IPs", async ({ page, request }) => {
  // 60 events (two signed batches): clearly the busiest IP, whatever earlier test files sent.
  const busy = Array.from({ length: 30 }, () =>
    testEvent({ type: "suspicious_path", ip: "198.51.100.77", path: "/.env" }),
  );
  expect((await sendSigned(request, busy)).response.status()).toBe(202);
  expect((await sendSigned(request, busy)).response.status()).toBe(202);
  const fromOppora = [testEvent({ type: "rate_limited", ip: "198.51.100.78", status_code: 429 })];
  expect((await sendSigned(request, fromOppora, { source: "oppora" })).response.status()).toBe(202);

  await signInAsAdmin(page);

  const chart = page.getByRole("img", { name: /Events per hour, last 24 hours: \d+ in total/ });
  await expect(chart).toBeVisible();

  // Keyboard: focus the chart, ← → move between hours and show that hour's numbers.
  await chart.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("status").filter({ hasText: "IST" })).toContainText("HomeHaat");

  // The same numbers as a table (for screen readers and anyone who prefers numbers).
  await page.getByText("Show as a table").click();
  const table = page.getByRole("table", { name: "Events per hour, last 24 hours" });
  await expect(table.getByRole("row")).toHaveCount(25); // header + 24 hours

  // Busiest IPs: the scanner (60 events) is listed first.
  const ips = page.getByRole("list", { name: "Busiest IPs, last 24 hours" });
  await expect(ips.getByRole("listitem").first()).toContainText("198.51.100.77");

  if (process.env.SHOT_DIR)
    await page.screenshot({ path: `${process.env.SHOT_DIR}/overview.png`, fullPage: true });
});
