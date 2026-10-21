import { expect, test } from "@playwright/test";
import { E2E_URL } from "./fixtures";
import { signInAsAdmin } from "./helpers";

// Log upload: the same rules on a file, analysed in memory.
test("a sample auth.log shows brute force, stuffing and a new-IP sign-in", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/dashboard/upload");
  await page.getByRole("button", { name: "Sample auth.log" }).click();

  const results = page.getByRole("region", { name: "auth.log (sample)" });
  await expect(results.getByText("3 attacks found")).toBeVisible();
  await expect(results.getByText("Brute force on root")).toBeVisible();
  await expect(results.getByText("Credential stuffing from 198.51.100.66")).toBeVisible();
  await expect(results.getByText("Sign-in from a new IP for rasmi")).toBeVisible();
  await expect(page.getByRole("heading", { name: "auth.log (sample)" })).toBeFocused(); // keyboard users land here
  if (process.env.SHOT_DIR)
    await page.screenshot({ path: `${process.env.SHOT_DIR}/upload.png`, fullPage: true });
});

test("a chosen file is analysed; a .gz file is refused with a clear message", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/dashboard/upload");
  const access = (path: string, status: number) =>
    `203.0.113.50 - - [21/Oct/2026:10:00:0${status % 10} +0000] "GET ${path} HTTP/1.1" ${status} 0 "-" "x"`;

  await page.locator("#log-file").setInputFiles({
    name: "mine.log",
    mimeType: "text/plain",
    buffer: Buffer.from(["/.env", "/wp-admin/", "/.git/config"].map((p) => access(p, 404)).join("\n")),
  });
  await page.getByRole("button", { name: "Analyse" }).click();
  await expect(page.getByText("Scanning from 203.0.113.50")).toBeVisible();

  await page.locator("#log-file").setInputFiles({
    name: "old.log.gz",
    mimeType: "application/gzip",
    buffer: Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0x01]),
  });
  await page.getByRole("button", { name: "Analyse" }).click();
  await expect(page.getByText("This is a .gz file. Unzip it first")).toBeVisible();
});

test("the analyse API needs a signed-in session and a same-site request", async ({ request }) => {
  const body = "Oct 21 10:00:00 web1 sshd[1]: Invalid user a from 203.0.113.9 port 1";
  const signedOut = await request.post("/api/logs/analyze?source=homehaat", {
    headers: { "Content-Type": "text/plain", Origin: E2E_URL },
    data: body,
  });
  expect(signedOut.status()).toBe(401);
  const otherSite = await request.post("/api/logs/analyze?source=homehaat", {
    headers: { "Content-Type": "text/plain", Origin: "https://evil.example" },
    data: body,
  });
  expect(otherSite.status()).toBe(403);
});
