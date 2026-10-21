import { Activity, Bell, FileUp, LayoutDashboard, Server, Settings } from "lucide-react";
import type { Route } from "next";

/** The real dashboard, or the public read-only demo with made-up data (same pages, same components). */
export type Base = "/dashboard" | "/demo";

const NAV = [
  { path: "", label: "Overview", icon: LayoutDashboard, demo: true },
  { path: "/events", label: "Events", icon: Activity, demo: true },
  { path: "/alerts", label: "Alerts", icon: Bell, demo: true },
  { path: "/sources", label: "Sources", icon: Server, demo: false },
  { path: "/upload", label: "Log upload", icon: FileUp, demo: false },
  { path: "/settings", label: "Settings", icon: Settings, demo: false },
] as const;

/** The menu for the dashboard or the demo (the demo only has the read-only pages). */
export function navFor(base: Base) {
  return NAV.filter((n) => base === "/dashboard" || n.demo).map((n) => ({
    ...n,
    href: `${base}${n.path}` as Route,
  }));
}

/** The Overview link is active only on itself; the others also on their sub-pages (e.g. an alert's detail page). */
export function isActive(href: string, pathname: string, base: Base) {
  return href === base ? pathname === href : pathname === href || pathname.startsWith(href + "/");
}
