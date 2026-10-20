import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is off on purpose: every dashboard page shows live, per-request data, and the
  // nonce-based Content-Security-Policy (proxy.ts) needs every page rendered per request anyway.
  cacheComponents: false,
  // Lets the throwaway end-to-end copy (port 3101) run beside the normal one without sharing .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  devIndicators: { position: "bottom-right" },
  typedRoutes: true,
  // @node-rs/argon2 is a native module: load it from node_modules at runtime, don't bundle it.
  serverExternalPackages: ["@node-rs/argon2"],
  // Security headers on every response, API included. (The Content-Security-Policy is set per request in proxy.ts.)
  async headers() {
    const security = [
      { key: "X-Content-Type-Options", value: "nosniff" }, // don't guess file types
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" }, // old browsers; new ones use CSP frame-ancestors
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      ...(process.env.NODE_ENV === "production"
        ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
        : []),
    ];
    return [{ source: "/:path*", headers: security }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
