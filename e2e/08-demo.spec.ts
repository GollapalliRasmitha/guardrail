import { expect, test } from "@playwright/test";

// The public demo: no sign-in, made-up data, clearly labelled, and it never changes anything.
test("the demo works signed out, is labelled, shows all alert kinds, grows live and never writes", async ({
  page,
}) => {
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET" && r.method() !== "HEAD") writes.push(`${r.method()} ${r.url()}`);
  });

  await page.goto("/demo");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByRole("note")).toContainText("Demo data.");
  await expect(page.getByRole("img", { name: /Events per hour/ })).toBeVisible();

  // The fake live feed adds a row to the Overview's list within a few seconds.
  const rows = page.getByRole("table", { name: /Latest security events/ }).getByRole("row");
  const firstRow = await rows.nth(1).textContent();
  await expect.poll(async () => rows.nth(1).textContent(), { timeout: 15_000 }).not.toBe(firstRow);

  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Alerts" }).first().click();
  const list = page.getByRole("list", { name: /Alerts \(demo data\)/ });
  for (const mitre of ["T1110", "T1110.004", "T1565", "T1595", "T1499", "T1078"]) {
    await expect(list.getByText(mitre, { exact: true }).first()).toBeVisible();
  }

  await list.getByRole("link", { name: /Brute force on/ }).click();
  // dev mode compiles the incident page on its first visit
  await expect(page.getByRole("heading", { level: 1, name: /Brute force on/ })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("Demo: Acknowledge and Resolve are switched off")).toBeVisible();
  await expect(page.getByRole("button", { name: /Acknowledge|Resolve|Add note/ })).toHaveCount(0);
  await expect(page.getByRole("note")).toContainText("Demo data.");

  // Only read-only pages are in the demo menu.
  const nav = page.getByRole("navigation", { name: "Main" }).first();
  await expect(nav.getByRole("link", { name: "Settings" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Log upload" })).toHaveCount(0);

  expect(writes).toEqual([]);
  if (process.env.SHOT_DIR) {
    await page.goto("/demo");
    await page.screenshot({ path: `${process.env.SHOT_DIR}/demo.png`, fullPage: true });
  }
});
