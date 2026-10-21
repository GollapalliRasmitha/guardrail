import { expect, test, type Page } from "@playwright/test";
import { hmacHex } from "../lib/crypto";
import { E2E_KEYS } from "./fixtures";
import { e2eDb, sendSigned, signInAsAdmin, testEvent } from "./helpers";

/** The same keyed IP hash GuardRail stores (privacyHash), so a test can find "its" alert exactly. */
const ipKey = (ip: string) => hmacHex(Buffer.from(E2E_KEYS.HASH_SECRET, "base64"), ip);

// Detection → alerts → incident page, end to end. One signed-in browser for the whole file.
test.describe.configure({ mode: "serial" });
let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  await signInAsAdmin(page);
});

test.afterAll(async () => {
  await page.context().close();
});

/** Detection runs just after the ingest answer; wait (up to 10 s) for the alert row. */
async function waitForAlert(groupKeyLike: string): Promise<number> {
  for (let i = 0; i < 40; i++) {
    const { rows } = await e2eDb.query<{ id: string }>(
      "SELECT id FROM alert WHERE group_key LIKE $1 ORDER BY id DESC LIMIT 1",
      [groupKeyLike],
    );
    if (rows[0]) return Number(rows[0].id);
    await page.waitForTimeout(250);
  }
  throw new Error(`No alert for ${groupKeyLike}`);
}

const ACCOUNT = "e2eb0000000000000000000000000aaa"; // 32 hex characters, like a real actor_id

test("10 failed logins on one account raise a high brute-force alert", async ({ request }) => {
  const fails = Array.from({ length: 10 }, (_, i) =>
    testEvent({ actor: "victim@example.com", actor_id: ACCOUNT, ip: `203.0.113.${60 + (i % 3)}` }),
  );
  expect((await sendSigned(request, fails)).response.status()).toBe(202);
  const id = await waitForAlert(`brute_force:actor:${ACCOUNT}`);
  // The email step runs just after the alert is saved: wait for its timeline entry before opening the page.
  await expect
    .poll(
      async () =>
        (
          await e2eDb.query(
            "SELECT count(*)::int AS n FROM alert_activity WHERE alert_id = $1 AND kind = 'email_skipped'",
            [id],
          )
        ).rows[0].n,
      { timeout: 10_000 },
    )
    .toBe(1);

  await page.goto("/dashboard/alerts");
  const row = page.getByRole("link", { name: /Brute force on vi\*\*\*\*@example\.com/ });
  await expect(row).toBeVisible();
  await expect(row.getByText("High")).toBeVisible();
  await expect(row.getByText("T1110")).toBeVisible();

  await row.click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/alerts/${id}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Brute force on vi****@example.com");
  await expect(page.getByRole("link", { name: /T1110 Brute Force/ })).toHaveAttribute(
    "href",
    "https://attack.mitre.org/techniques/T1110/",
  );
  await expect(page.getByText("Alert raised (high) with 10 events")).toBeVisible();
  await expect(page.getByText(/No email: email isn't set up yet/)).toBeVisible();
});

test("acknowledge, add a note, resolve, reopen", async () => {
  const status = page.getByRole("group", { name: "Change status" });
  await status.getByRole("button", { name: "Acknowledge" }).click();
  await expect(page.locator("header").getByText("Acknowledged")).toBeVisible();

  await page.getByLabel("Add a note").fill("Checked: no sign-in succeeded.");
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Checked: no sign-in succeeded." }),
  ).toBeVisible();

  await status.getByRole("button", { name: "Resolve" }).click();
  await expect(page.locator("header").getByText("Resolved")).toBeVisible();
  await expect(page.getByText("Marked resolved (was acknowledged)")).toBeVisible();

  await status.getByRole("button", { name: "Reopen" }).click();
  await expect(page.locator("header").getByText("Open", { exact: true })).toBeVisible();
  await status.getByRole("button", { name: "Resolve" }).click();
  await expect(page.locator("header").getByText("Resolved")).toBeVisible();
});

test("after resolving, one stray failure doesn't bring the old attack back", async ({ request }) => {
  await sendSigned(request, [testEvent({ actor: "victim@example.com", actor_id: ACCOUNT })]);
  await page.waitForTimeout(3000); // give detection time to (not) act
  const { rows } = await e2eDb.query(
    "SELECT count(*)::int AS n FROM alert WHERE group_key = $1 AND status <> 'resolved'",
    [`brute_force:actor:${ACCOUNT}`],
  );
  expect(rows[0].n).toBe(0);
});

test("scanning starts low and is raised to medium as more paths arrive", async ({ request }) => {
  const ip = "198.51.100.77";
  await sendSigned(request, [
    testEvent({ type: "suspicious_path", ip, path: "/.env", method: "GET", status_code: 404 }),
  ]);
  const id = await waitForAlert(`scanning:ip:${ipKey(ip)}`);
  const more = ["/wp-admin/", "/.git/config", "/phpmyadmin/", "/xmlrpc.php"].map((path) =>
    testEvent({ type: "suspicious_path", ip, path, method: "GET", status_code: 404 }),
  );
  await sendSigned(request, more);

  await expect
    .poll(
      async () => (await e2eDb.query("SELECT severity FROM alert WHERE id = $1", [id])).rows[0].severity,
      {
        timeout: 10_000,
      },
    )
    .toBe("medium");
  await page.goto(`/dashboard/alerts/${id}`);
  await expect(page.getByText("Severity raised from low to medium")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Evidence · 5 events/ })).toBeVisible();
});

test("a forged webhook is high, and the sidebar counts open alerts", async ({ request }) => {
  await sendSigned(request, [
    testEvent({
      type: "webhook_signature_failed",
      actor: undefined,
      path: "/api/payments/webhook/",
      status_code: 400,
    }),
  ]);
  await waitForAlert("forged_webhook:source:homehaat");
  const { rows } = await e2eDb.query("SELECT count(*)::int AS n FROM alert WHERE status <> 'resolved'");

  await page.goto("/dashboard");
  const alertsLink = page
    .getByRole("navigation", { name: "Main" })
    .first()
    .getByRole("link", { name: /Alerts/ });
  await expect(alertsLink).toContainText(String(rows[0].n));
  await expect(
    page.getByRole("region", { name: "Open alerts" }).getByText("Forged payment webhook at HomeHaat"),
  ).toBeVisible();
});
