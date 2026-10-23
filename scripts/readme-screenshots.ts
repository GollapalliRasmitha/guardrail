// README screenshots: the LIVE public pages (home + demo: made-up data only) and an animated PNG of the globe.
// Run: npx tsx scripts/readme-screenshots.ts   (log upload comes from: SHOT_DIR=docs/screenshots npx playwright test e2e/01-auth.spec.ts e2e/06-upload.spec.ts -g "first sign-in|sample auth")
import { mkdirSync, writeFileSync } from "node:fs";
import { crc32 } from "node:zlib";
import { chromium, type Page } from "@playwright/test";

const BASE = "https://guardrail-rasmitha.vercel.app";
const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });

// ---- APNG: same-size PNG frames → one animated PNG (plays in browsers and on GitHub like a GIF) -------------------
type Chunk = { type: string; data: Buffer };
function chunks(png: Buffer): Chunk[] {
  const out: Chunk[] = [];
  for (let at = 8; at < png.length;) {
    const len = png.readUInt32BE(at);
    out.push({ type: png.toString("ascii", at + 4, at + 8), data: png.subarray(at + 8, at + 8 + len) });
    at += 12 + len;
  }
  return out;
}
function chunk(type: string, data: Buffer) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])) >>> 0);
  return Buffer.concat([head, data, crc]);
}
function apng(frames: Buffer[], delayMs: number) {
  const first = chunks(frames[0]!);
  const ihdr = first.find((c) => c.type === "IHDR")!.data;
  const [w, h] = [ihdr.readUInt32BE(0), ihdr.readUInt32BE(4)];
  const parts = [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr)];
  const actl = Buffer.alloc(8);
  actl.writeUInt32BE(frames.length, 0); // frames; plays forever (0 loops)
  parts.push(chunk("acTL", actl));
  let seq = 0;
  frames.forEach((frame, i) => {
    const fctl = Buffer.alloc(26);
    fctl.writeUInt32BE(seq++, 0);
    fctl.writeUInt32BE(w, 4);
    fctl.writeUInt32BE(h, 8);
    fctl.writeUInt16BE(delayMs, 20);
    fctl.writeUInt16BE(1000, 22);
    parts.push(chunk("fcTL", fctl));
    for (const c of chunks(frame).filter((c) => c.type === "IDAT")) {
      if (i === 0) parts.push(chunk("IDAT", c.data));
      else {
        const seqBuf = Buffer.alloc(4);
        seqBuf.writeUInt32BE(seq++);
        parts.push(chunk("fdAT", Buffer.concat([seqBuf, c.data])));
      }
    }
  });
  parts.push(chunk("IEND", Buffer.alloc(0)));
  return Buffer.concat(parts);
}

async function settle(page: Page, ms = 1500) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(ms);
}

async function main() {
  const browser = await chromium.launch();
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await desktop.goto(BASE + "/");
  await settle(desktop, 6000); // let the globe load and a few attacks fly
  await desktop.screenshot({ path: `${OUT}/home.png` });

  // The globe: 36 frames, 120 ms apart (about 4 s), cropped to the globe.
  const globe = desktop.locator('[role="img"][aria-label^="Globe:"]').locator("..");
  const frames: Buffer[] = [];
  for (let i = 0; i < 36; i++) {
    frames.push(await globe.screenshot({ scale: "css" }));
    await desktop.waitForTimeout(120);
  }
  writeFileSync(`${OUT}/globe.png`, apng(frames, 120));

  await desktop.getByRole("heading", { name: "What it catches" }).scrollIntoViewIfNeeded();
  await desktop.getByRole("button", { name: /^Brute force:/ }).click();
  await desktop.waitForTimeout(900);
  await desktop
    .locator("#catches")
    .locator("xpath=..")
    .screenshot({ path: `${OUT}/rules.png` });

  await desktop.goto(BASE + "/demo");
  await settle(desktop);
  await desktop.screenshot({ path: `${OUT}/dashboard.png`, fullPage: true });

  await desktop.goto(BASE + "/demo/alerts");
  await settle(desktop);
  await desktop.screenshot({ path: `${OUT}/alerts.png` });
  await desktop
    .getByRole("link", { name: /Brute force on/ })
    .first()
    .click();
  await settle(desktop);
  await desktop.screenshot({ path: `${OUT}/incident.png`, fullPage: true });

  const phone = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  await phone.goto(BASE + "/");
  await settle(phone, 5000);
  await phone.screenshot({ path: `${OUT}/phone-home.png` });
  await phone.goto(BASE + "/demo");
  await settle(phone);
  await phone.screenshot({ path: `${OUT}/phone-dashboard.png` });
  await phone.goto(BASE + "/demo/alerts");
  await settle(phone);
  await phone.screenshot({ path: `${OUT}/phone-alerts.png` });

  await browser.close();
}
main();
