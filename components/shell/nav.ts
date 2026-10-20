import { Activity, Bell, FileUp, LayoutDashboard, Server, Settings } from "lucide-react";
import type { Route } from "next";

export const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/events", label: "Events", icon: Activity },
  { href: "/dashboard/alerts", label: "Alerts", icon: Bell },
  { href: "/dashboard/sources", label: "Sources", icon: Server },
  { href: "/dashboard/upload", label: "Log upload", icon: FileUp },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
] as const satisfies readonly { href: Route; label: string; icon: unknown }[];

/** "/dashboard" is active only on itself; the others also on their sub-pages (e.g. an alert's detail page). */
export function isActive(href: string, pathname: string) {
  return href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(href + "/");
}
