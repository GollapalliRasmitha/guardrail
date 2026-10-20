import { NextResponse, type NextRequest } from "next/server";

// Runs before every page. It sets the security headers, including a Content-Security-Policy with a fresh random
// "nonce" per request: the browser runs only <script> tags carrying that nonce (Next.js adds it to its own
// scripts automatically), so a script injected by an attacker (XSS) is refused.
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";

  const csp = [
    "default-src 'self'",
    // 'strict-dynamic': scripts loaded by a trusted (nonced) script are trusted too. React needs eval only in dev.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Inline styles are allowed: React style={} props and chart libraries need them; styles can't run code.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:", // data: for the 2FA QR code
    "font-src 'self'", // next/font serves the Google fonts from our own domain
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'", // nobody may put GuardRail inside an <iframe> (clickjacking)
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: not API routes, static files or prefetches (they don't run scripts).
      source: "/((?!api|_next/static|_next/image|icon.svg).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
