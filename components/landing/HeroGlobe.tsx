"use client";

import dynamic from "next/dynamic";
import { ShieldCheck, Siren } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { seeded } from "@/lib/demo/random";
import { ARC_MS, nextAttack, type Attack } from "@/lib/landing/attacks";
import type { PublicFeed } from "@/lib/public/feed";
import type { GlobePalette } from "./Globe";
import { StaticGlobe } from "./StaticGlobe";

// Three.js is only downloaded when it will actually be used (and never during server rendering).
const Globe = dynamic(() => import("./Globe"), { ssr: false, loading: () => <StaticGlobe /> });

const SIMULATED: PublicFeed = { mode: "simulated", total: 0, highAlerts: 0, countries: [] };
const regionName = new Intl.DisplayNames(["en"], { type: "region" });

// ---- "can and may we animate?" (read straight from the browser, so no flash of the wrong version) -------------
const REDUCE = "(prefers-reduced-motion: reduce)";
function subscribeMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
let webgl: boolean | undefined;
function canAnimate() {
  webgl ??= (() => {
    try {
      const c = document.createElement("canvas");
      return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
    } catch {
      return false;
    }
  })();
  return webgl && !window.matchMedia(REDUCE).matches;
}

/** The design tokens, read from CSS, for the WebGL scene. */
function readPalette(): GlobePalette {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    panel: v("--panel"),
    line: v("--line"),
    muted: v("--muted"),
    accent: v("--accent"),
    high: v("--sev-high"),
  };
}

/**
 * The home page's globe: attacks fly from their country to the servers in Singapore, flash when they hit (blocked),
 * and high alerts travel on to the owner in India. Real country totals when there are some, otherwise simulated
 * (and labelled so). Reduced motion or no WebGL → a still picture. Paused when off screen or the tab is hidden.
 */
export function HeroGlobe() {
  const animate = useSyncExternalStore(subscribeMotion, canAnimate, () => false);
  const box = useRef<HTMLDivElement>(null);
  const [feed, setFeed] = useState<PublicFeed | null>(null);
  const [visible, setVisible] = useState(true);
  const [attacks, setAttacks] = useState<Attack[]>([]);
  const [blocked, setBlocked] = useState(0);
  const [latest, setLatest] = useState<Attack | null>(null);
  const [palette, setPalette] = useState<GlobePalette | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/attacks")
      .then((r) => (r.ok ? (r.json() as Promise<PublicFeed>) : SIMULATED))
      .catch(() => SIMULATED)
      .then((f) => {
        if (!cancelled) {
          setFeed(f);
          setPalette(readPalette());
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Pause when scrolled away or when the tab is hidden: no work nobody can see.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let onScreen = true;
    const update = () => setVisible(onScreen && document.visibilityState === "visible");
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = Boolean(entry?.isIntersecting);
      update();
    });
    observer.observe(el);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  // A new attack every second or so (fewer on small screens); it counts as blocked when it reaches the servers.
  useEffect(() => {
    if (!animate || !feed || !visible) return;
    const rand = seeded(Date.now() % 100_000);
    const small = window.matchMedia("(max-width: 640px)").matches;
    let id = 0;
    const landings: ReturnType<typeof setTimeout>[] = [];
    const timer = setInterval(
      () => {
        const attack = nextAttack(rand, feed, Date.now() * 10 + id++, performance.now());
        setAttacks((list) => [...list.filter((a) => performance.now() - a.bornAt < 6_000), attack]);
        landings.push(
          setTimeout(() => {
            setBlocked((n) => n + 1);
            setLatest(attack);
          }, ARC_MS),
        );
      },
      small ? 1_600 : 1_000,
    );
    return () => {
      clearInterval(timer);
      landings.forEach(clearTimeout);
    };
  }, [animate, feed, visible]);

  const live = feed?.mode === "live";
  const label = live
    ? `Globe: attack events from ${feed.countries.length} countries in the last 24 hours, all blocked before reaching the sites.`
    : "Globe: simulated attacks flying to the servers in Singapore and being blocked.";

  return (
    <div ref={box} className="relative mx-auto aspect-square w-full max-w-[36rem]">
      <div role="img" aria-label={label} className="absolute inset-0">
        {animate && palette ? (
          <Globe attacks={attacks} palette={palette} paused={!visible} />
        ) : (
          <StaticGlobe />
        )}
      </div>

      {feed && (
        <>
          <div className="glass float absolute top-[4%] left-0 max-w-[15rem] rounded-xl px-3.5 py-2.5 text-xs sm:left-[2%]">
            <p className="eyebrow">{live ? "Real data · last 24 h" : "Simulated attacks"}</p>
            <p className="mt-1 text-muted">
              {live ? (
                <>
                  <span className="font-mono text-text">{feed.total}</span> attack events from{" "}
                  <span className="font-mono text-text">{feed.countries.length}</span> countries · countries
                  only, never IPs
                </>
              ) : (
                "No real attacks to show yet, so these are made up."
              )}
            </p>
          </div>

          <div
            className="glass float absolute right-0 bottom-[6%] w-[15.5rem] rounded-xl px-3.5 py-2.5 text-xs [animation-delay:-3s] sm:right-[2%]"
            aria-live="off"
          >
            <p className="flex items-center gap-1.5 text-ok">
              <ShieldCheck className="size-3.5" aria-hidden />
              <span className="font-mono">{blocked}</span> blocked {animate ? "while you watched" : ""}
            </p>
            <p className="mt-1 truncate font-mono text-muted">
              {latest ? `${regionName.of(latest.code) ?? latest.code} → Singapore` : "Watching…"}
            </p>
            {latest?.high && (
              <p className="mt-1 flex items-center gap-1.5 text-sev-high">
                <Siren className="size-3.5" aria-hidden /> High alert → owner in India
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
