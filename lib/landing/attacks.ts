// The attacks drawn on the home page's globe. In "live" mode they're picked in proportion to the real country totals
// (the last 24 hours); in "simulated" mode from a fixed list. Either way only a country travels, never an IP.

import { ATTACKER_COUNTRIES, type Random } from "@/lib/demo/random";
import { COUNTRY_CENTRES } from "@/lib/geo/countries";
import type { PublicFeed } from "@/lib/public/feed";

export type Attack = { id: number; code: string; lat: number; lon: number; high: boolean; bornAt: number };

/** How long an attack takes to reach the servers (the globe draws it; the panels count it as blocked then). */
export const ARC_MS = 1700;

const SIMULATED_HIGH = 0.12; // about one in eight is a high alert that travels on to the owner

export function nextAttack(rand: Random, feed: PublicFeed, id: number, bornAt: number): Attack {
  if (feed.mode === "live" && feed.countries.length > 0) {
    let pick = rand.next() * feed.total;
    const country = feed.countries.find((c) => (pick -= c.attacks) < 0) ?? feed.countries[0]!;
    const highShare = feed.highAlerts > 0 ? Math.min(0.25, (feed.highAlerts * 10) / feed.total) : 0;
    return {
      id,
      code: country.code,
      lat: country.lat,
      lon: country.lon,
      high: rand.next() < highShare,
      bornAt,
    };
  }
  const code = rand.pick(ATTACKER_COUNTRIES);
  const [lat, lon] = COUNTRY_CENTRES[code]!;
  return { id, code, lat, lon, high: rand.next() < SIMULATED_HIGH, bornAt };
}
