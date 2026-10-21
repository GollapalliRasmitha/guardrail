import { and, count, eq, gt, inArray, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { publicFeed, type PublicFeed } from "@/lib/public/feed";

// Event types that mean "someone attacked" (normal sign-ins and payments are not shown).
const ATTACK_TYPES = [
  "login_failed",
  "rate_limited",
  "suspicious_path",
  "webhook_signature_failed",
  "permission_denied",
] as const;

/** Public, no sign-in: country totals for the home page's globe (see lib/public/feed.ts for what's left out). */
export async function GET() {
  const e = schema.event;
  const since = new Date(Date.now() - 24 * 3_600_000);
  let feed: PublicFeed;
  try {
    const [rows, [high]] = await Promise.all([
      db()
        .select({ country: e.country, n: count() })
        .from(e)
        .where(and(gt(e.receivedAt, since), isNotNull(e.country), inArray(e.type, [...ATTACK_TYPES])))
        .groupBy(e.country),
      db()
        .select({ n: count() })
        .from(schema.alert)
        .where(and(eq(schema.alert.severity, "high"), gt(schema.alert.lastSeen, since))),
    ]);
    feed = publicFeed(
      rows.map((r) => ({ country: r.country!, n: r.n })),
      high?.n ?? 0,
    );
  } catch {
    feed = publicFeed([], 0); // the home page must work even if the database is asleep
  }
  // Cached for a minute by browsers and Vercel's edge, so visitors don't each wake the database.
  return NextResponse.json(feed, { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } });
}
