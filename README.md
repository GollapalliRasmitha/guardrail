# GuardRail

A mini SIEM (security monitoring dashboard) for two live web apps, HomeHaat and Oppora: signed event intake,
MITRE ATT&CK-mapped detection rules, alerts and a real-time dashboard. Built with Next.js 16, TypeScript, Postgres
(Drizzle), Tailwind CSS, Vitest and Playwright.

> Work in progress: Stages 1–4 of 7 are done (sign-in with 2FA, signed event intake, live events, HomeHaat sending events, MITRE-mapped detection and alerts). The full README, with
> screenshots, "Web development highlights" and "Security highlights", comes in Stage 7.

## Run it locally (Windows)

Needs Docker Desktop and Node.js 22+.

1. Double-click **Start GuardRail.bat** (or run `powershell -ExecutionPolicy Bypass -File .\start-guardrail.ps1`).
2. First time only, in a terminal in this folder: `npm run admin:create` (you type your email and password there).
3. Open http://localhost:3100, sign in, and scan the QR code with an authenticator app.

Tests: `npm run check` (lint, types, unit tests) and `npm run test:e2e` (Playwright, uses a separate throwaway
database).
