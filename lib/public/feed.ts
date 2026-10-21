// [KEY LOGIC] The ONLY data the public home page gets: how many attack events came from each country in the last
// 24 hours, and how many high alerts there were. Never IPs, accounts, paths or exact times. Countries with fewer than
// MIN_PER_COUNTRY events are left out, so a single visitor's typo can't be read as "someone in <country>".

import { COUNTRY_CENTRES } from "@/lib/geo/countries";

export const MIN_PER_COUNTRY = 3;

export type PublicCountry = { code: string; lat: number; lon: number; attacks: number };
export type PublicFeed = {
  mode: "live" | "simulated"; // simulated = nothing real to show; the page makes attacks up and says so
  total: number;
  highAlerts: number;
  countries: PublicCountry[];
};

export function publicFeed(rows: { country: string; n: number }[], highAlerts: number): PublicFeed {
  const countries = rows
    .filter((r) => r.n >= MIN_PER_COUNTRY && COUNTRY_CENTRES[r.country])
    .map((r) => {
      const [lat, lon] = COUNTRY_CENTRES[r.country]!;
      return { code: r.country, lat, lon, attacks: r.n };
    })
    .sort((a, b) => b.attacks - a.attacks);
  if (countries.length === 0) return { mode: "simulated", total: 0, highAlerts: 0, countries: [] };
  return { mode: "live", total: countries.reduce((n, c) => n + c.attacks, 0), highAlerts, countries };
}
