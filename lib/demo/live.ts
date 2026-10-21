import type { EventView } from "@/lib/events/filters";
import { ATTACKER_COUNTRIES, DEMO_USERS, SCANNER_PATHS, type Random } from "./random";

/** One made-up event for the demo's live feed: mostly normal sign-ins, sometimes a typo or a bot. */
export function demoLiveEvent(rand: Random, id: number, now: Date): EventView {
  const source = rand.pick(["homehaat", "oppora"] as const);
  const signIn = source === "homehaat" ? "/api/auth/signin/" : "/api/auth/google/callback/";
  const roll = rand.next();
  const base = { id, source, occurredAt: now.toISOString(), method: "POST", path: signIn };
  if (roll < 0.1) {
    return {
      ...base,
      type: "suspicious_path",
      ip: `203.0.113.${rand.int(150, 199)}`,
      country: rand.pick(ATTACKER_COUNTRIES),
      actor: null,
      method: "GET",
      path: rand.pick(SCANNER_PATHS),
      statusCode: 404,
    };
  }
  const user = rand.pick(DEMO_USERS);
  const failed = roll < 0.3;
  return {
    ...base,
    type: failed ? "login_failed" : "login_success",
    ip: user.ip,
    country: user.country,
    actor: user.actor,
    statusCode: failed ? 401 : 200,
  };
}
