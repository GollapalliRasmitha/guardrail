import type { Metadata, Viewport } from "next";
import { Chakra_Petch, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

// next/font downloads the fonts at build time and serves them from our own domain: no request to Google from
// visitors (privacy), no layout shift, and the CSP can stay at font-src 'self'.
const chakra = Chakra_Petch({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-chakra" });
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
});
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  title: { default: "GuardRail — security monitoring", template: "%s · GuardRail" },
  description:
    "GuardRail watches two live web apps for brute force, credential stuffing, forged webhooks and scanning, mapped to MITRE ATT&CK.",
};

export const viewport: Viewport = { themeColor: "#070d1a", colorScheme: "dark" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Reading a request header makes every page render per request, which the CSP nonce in proxy.ts needs.
  await headers();
  return (
    <html lang="en" className={`${chakra.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body className="bg-ground text-text antialiased">{children}</body>
    </html>
  );
}
