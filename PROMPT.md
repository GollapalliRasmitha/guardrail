# GUARDRAIL — Build Brief for Claude Code

You are the lead engineer, product designer and **teacher** for **GuardRail**, a small security monitoring
dashboard (a "mini SIEM") that watches my two **live** websites:

| Site | Frontend | API | Repo | Local folder |
|---|---|---|---|---|
| **HomeHaat** (marketplace) | https://homehaat.vercel.app | Django on Render | GollapalliRasmitha/homehaat | `C:\Users\rasmi\homehaat` |
| **Oppora** | https://oppora-app.vercel.app | (see its repo) | GollapalliRasmitha/Oppora | (ask me) |

HomeHaat and Oppora send **security events** (failed logins, forged webhooks, scans…) to GuardRail. GuardRail
checks them against **detection rules mapped to MITRE ATT&CK**, raises **alerts**, emails me the serious ones, and
shows everything **live** on a dark "security control room" dashboard. A public 3D landing page and a read-only
demo let recruiters see it without signing in.

I'm Rasmitha. This is my 3rd project, after Oppora and HomeHaat. I'm applying for **web developer** jobs, with
security as my bonus strength, so GuardRail must clearly show **modern web development** (Next.js, TypeScript,
real-time UI, accessibility, tests, 3D) **and** security (HMAC, replay protection, 2FA, rate limiting, privacy).

---

## 0. How we work (read this first)

1. **7 stages, in the order in Section 11.** At the end of each stage:
   - run lint, type-check, unit tests and (from Stage 2) the Playwright tests, and fix any failures
   - confirm earlier features still work
   - commit with a message like `stage-2: signed ingest API + live events` and push to GitHub
   - post a short summary: what was built, what you assumed, what's left, what I must do myself, and
     **3 interview questions about this stage with short answers**
   - **stop and wait for me to say "continue"**.
2. **Explain mode (you write all the code).** I don't write code. Functions marked **[KEY LOGIC]** in Section 11:
   - write the tests first, then the implementation
   - after the stage, explain each one in plain English in the **"How it works"** section of `CLAUDE.md`: what it
     does, step by step, why it is safe, which TypeScript / Next.js / Node / Postgres features it uses, and a
     *"Say it:"* line I can say out loud in an interview
   - keep the code short and readable, with clear names and comments on the tricky lines.
   Everything else, build as usual.
3. **Keep `CLAUDE.md` up to date:** current stage, commands, folder structure, design tokens, components, API,
   decisions, "How it works", and "Interview notes" (3 Q&As per stage).
4. **One design system.** Every page uses the shared tokens and components (Section 3). Don't restyle a component
   for one page.
5. **Free only.** Ask me before anything that costs money, before adding a new service or tool to the setup,
   changing a design token, or a data-model change that breaks earlier stages.
6. **Real data only** in the real dashboard: every number is computed from the database; when there's no data,
   show a designed empty state, never a made-up number. Fake data exists **only** in demo mode (Stage 6), is
   clearly labelled "Demo data", and never mixes with real events.

### Safety rules (same spirit as HomeHaat — these always win)

- **Never ask me to paste a secret in chat.** Secrets go into `.env` (local) or the Vercel / Render dashboards
  (online). Tell me *which name* to set and *where*; I type the value myself.
- `.env` is never committed; only `.env.example` with **empty** values. Check `git status` before every push.
- **`throwaway_check` before any delete.** No command or script may delete or truncate data unless it first proves
  it targets the throwaway database (`guardrail_e2e` on `localhost`). Scripts call `assertThrowaway()`; shell
  commands run `npm run throwaway-check` first and stop if it fails.
- **Tests for every stage.**
- **Changes to HomeHaat and Oppora are small, additive and tested**, and must **never** break them or slow them
  down (Section 6). Their own test suites must still pass afterwards. Commit them in their own repos with their
  own messages.
- **The attack simulator attacks my LOCAL copies only** (localhost). It refuses any other host. Never point load,
  scans or forged requests at the live sites.

---

## 1. Tech stack (all free)

| Layer | Choice | Why |
|---|---|---|
| App | **Next.js 16** (App Router, Route Handlers) + **TypeScript strict** | one full-stack app: pages + typed API |
| Styling | Tailwind CSS v4 with CSS-variable tokens | fast, consistent, tokens in one file |
| Database | **PostgreSQL** — Docker locally (port **5434**), **Neon** free online | same SQL everywhere |
| Data access | **Drizzle ORM** + `pg` + drizzle-kit migrations | typed queries, plain SQL feel |
| Validation | **Zod** — every request body and query string | typed API, rejects bad input |
| Passwords | **Argon2id** (`@node-rs/argon2`) | modern, memory-hard hashing |
| 2FA | **TOTP** (RFC 6238, authenticator apps), written by us on Node `crypto`; QR via `qrcode` | key logic to explain |
| Real-time | **Server-Sent Events** (Section 7) | works on Vercel Hobby, no paid service |
| Email | **Resend** free tier, to my own address only | high alerts |
| Charts | Recharts (Stage 6) | accessible SVG charts |
| 3D | Three.js via `@react-three/fiber` + `drei` (Stage 6) | landing globe |
| Tests | **Vitest** (unit) + **Playwright** (end-to-end) | |
| Hosting | **Vercel Hobby** (doesn't sleep) + **Neon** | |

**Free-tier limits checked on 20 Oct 2026** (re-check before Stage 7):
- **Vercel Hobby:** functions run at most **300 s** (default and maximum, can't be raised); streamed responses count
  towards it. About 1M function invocations / month, 100 GB transfer, ~4 h active CPU. Non-commercial use only.
  Over the limit the project is **paused, not billed**.
- **Neon Free:** 0.5 GB storage per project, **100 CU-hours compute per project per month**, 5 GB transfer;
  compute sleeps after 5 idle minutes. Over the limit compute is suspended, not billed.
- **Resend Free:** 3,000 emails / month, **100 / day**; without my own domain it can only send to my own address
  (that's all we need). Over the limit sending pauses, not billed.

What that means for the design: keep the SSE stream short (Section 7) so it never hits 300 s, keep events small,
delete old IPs and old raw events on a schedule, and cap emails (max 1 email per alert, max 20 / day).

**Local ports:** Postgres **5434** (HomeHaat 5433, Oppora 5432), GuardRail **3100** (HomeHaat/Oppora use 3000 and
8000), end-to-end copy **3101** with database `guardrail_e2e`. So all three projects can run at the same time.

**Local setup stays small:** Docker Desktop (Postgres only) + Node LTS. One `start-guardrail.ps1` (and a
double-click `Start GuardRail.bat`) that checks the tools, creates `.env` with random local keys, starts Postgres,
installs packages, runs migrations and opens the app on http://localhost:3100.

---

## 2. Data model (Postgres, via Drizzle)

- `admin_user` — the one account: email, `password_hash` (Argon2id), `totp_secret_enc` (AES-256-GCM encrypted),
  `totp_enabled`, `totp_last_step` (stops a code being used twice), created/updated.
- `session` — `token_hash` (SHA-256 of a random cookie token; the raw token is never stored), user, `mfa_passed`,
  `expires_at`, `last_seen_at`, `ip_hash`, `user_agent`.
- `auth_attempt` — sign-in attempts for the rate limit: `ip_hash`, `email_hash`, `kind`, `ok`, `created_at`.
- `source` (Stage 2) — `homehaat`, `oppora`: name, `key_id`, **no secret in the database** (secrets live in env
  vars `INGEST_SECRET_HOMEHAAT`, `INGEST_SECRET_OPPORA`), `last_seen_at`.
- `event` (Stage 2) — id, source, `type` (enum, Section 5), `occurred_at`, `received_at`, `ip` (nullable, wiped after
  30 days), `ip_hash` (kept for counting), `country` (2-letter), `actor` (masked email), `path`, `method`,
  `status_code`, `user_agent` (trimmed), `meta` (small JSONB, allow-listed keys only), `nonce` (unique per source:
  replay protection).
- `alert` (Stage 4) — rule id, MITRE technique, severity, status (open / acknowledged / resolved), title, `group_key`
  (e.g. rule + IP, so repeats update one alert instead of creating 100), first/last seen, event count,
  `emailed_at`.
- `alert_event` (link table), `alert_note` (text, created_at), `alert_activity` (the incident timeline: created,
  new events, status changes, notes, email sent).
- `log_upload` (Stage 6) — file name, kind (nginx / apache / auth.log), line count, events found, created_at.
- Indexes on everything used to filter or join: `event(source, occurred_at)`, `event(type, occurred_at)`,
  `event(ip_hash, occurred_at)`, `alert(status, severity, last_seen_at)`, `alert(group_key)`.

---

## 3. Design system — "security control room"

Dark, calm, precise. Deep navy ground, thin lines, one teal accent, colour used **only** to mean something.

| Token | Value | Use |
|---|---|---|
| `--ground` | `#070D1A` | page background |
| `--panel` | `#0D1628` | cards, sidebar |
| `--panel-2` | `#12203A` | raised / hover |
| `--line` | `#1E2E4A` | borders, grid lines |
| `--text` | `#E6EDF7` | main text |
| `--muted` | `#8EA2C0` | labels, secondary text (≥ 4.5:1 on panel) |
| `--accent` | `#6FD3C5` | teal: focus rings, primary buttons, "live" |
| `--sev-high` | `#FF6B6B` | red: high / critical |
| `--sev-medium` | `#F5B74E` | amber: medium |
| `--sev-low` | `#5EA3FF` | blue: low / info |
| `--ok` | `#4ADE80` | resolved / healthy |

- **Fonts** (`next/font/google`): **Chakra Petch** for headings and numbers on cards, **IBM Plex Sans** for body,
  **IBM Plex Mono** for IPs, times, IDs, codes and MITRE technique IDs.
- Severity is never colour alone: always a label ("High") and an icon too (colour-blind safe).
- Components (shared, in `components/`): `AppShell` (sidebar + top bar, collapses to a bottom bar / menu on phones),
  `StatCard`, `Panel`, `SeverityBadge`, `StatusBadge`, `LiveDot`, `EmptyState`, `LoadError`, `Skeleton`, `Button`,
  `TextField`, `DataTable` (with pagination), `Mono`.
- Every page: **phone first**, loading (skeleton) / empty / error states, keyboard only works everywhere (visible
  teal focus ring, skip link), screen-reader labels, contrast ≥ 4.5:1, `prefers-reduced-motion` respected.
  Target **Lighthouse ≥ 90** for Performance, Accessibility, Best Practices, SEO on the landing page and dashboard.

---

## 4. Security of GuardRail itself

- **Only I can sign in.** No sign-up page. The one account is created with `npm run admin:create`, which asks for
  the email and password **in the terminal** (I type them; never in chat). Password ≥ 14 characters and not a
  common password.
- **Sign-in = password + 2FA.** Step 1 email + password (Argon2id). Step 2 a 6-digit code from an authenticator app
  (TOTP). The first sign-in forces 2FA setup (QR code + confirm a code). A code can't be used twice.
- **Login rate limit:** after 5 failed tries in 15 minutes from one IP, or 10 for the account, sign-in is blocked
  for 15 minutes. Same message for "no such email" and "wrong password", and the same time taken.
- **Sessions:** random 256-bit token in an `httpOnly`, `Secure` (online), `SameSite=Lax` cookie (Lax so the link in an
  alert email opens the dashboard); only its SHA-256
  is stored; 12 h maximum, 2 h idle; sign out deletes it.
- **CSRF:** `SameSite=Lax` + every state-changing API route checks the `Origin` header.
- **Headers:** strict Content-Security-Policy with a per-request nonce, `frame-ancestors 'none'`, `nosniff`,
  `Referrer-Policy`, `Permissions-Policy`, HSTS online.
- **Secrets** only in env vars, read through one typed, validated `lib/env.ts`. The TOTP secret is encrypted in the
  database with `ENCRYPTION_KEY` (AES-256-GCM).
- **Privacy:** never store passwords, tokens, card data or webhook bodies; emails stored masked
  (`ra****@gmail.com`); IPs kept 30 days then wiped (the hash stays for counting); the public landing page and demo
  show **countries only, never IPs**.

---

## 5. Events and detection

### Event types (sent by HomeHaat / Oppora, or parsed from uploaded logs)
`login_failed`, `login_success`, `admin_login`, `password_reset_requested`, `password_reset_done`,
`rate_limited`, `webhook_signature_failed` (Razorpay), `payment_failed`, `refund_issued`, `suspicious_path`
(`/wp-admin`, `/.env`, `/phpmyadmin`, `/.git`…), `permission_denied`, `new_device_login`.

### Detection rules (Stage 4) — each with a MITRE ATT&CK id and severity

| Rule | MITRE | Fires when (first version; tuned later) | Severity |
|---|---|---|---|
| Brute force | **T1110** | ≥ 10 `login_failed` for one account in 10 min | High |
| Credential stuffing | **T1110.004** | one IP fails on ≥ 5 *different* accounts in 10 min | High |
| Forged webhook | **T1565** (Data Manipulation) | any `webhook_signature_failed` | High |
| Scanning | **T1595** (Active Scanning) | ≥ 5 `suspicious_path` from one IP in 5 min (1 = low) | Medium |
| Flood | **T1499** (Endpoint DoS) | ≥ 50 `rate_limited` from one IP in 1 min | Medium |
| Valid account, new IP | **T1078** | `login_success` / `admin_login` from an IP or country not seen for that account in 30 days | Medium (High for admin) |

Rules are **pure functions** (events in → findings out) so they're easy to unit-test, and run on every ingest
(only the rules that care about that event type) and on uploaded logs.

### Alerts
Severity, status **open → acknowledged → resolved** (can reopen), notes, and an **incident timeline** (every event,
status change, note and email in time order). Repeats of the same rule + IP/account update the open alert
instead of creating a new one. **High** alerts email me through Resend (one email per alert, max 20 / day) with a
link to the incident; the email contains no IPs or emails in full.

---

## 6. Event intake — `POST /api/ingest` (HMAC-signed)

Each source signs every request with its **own** secret:

```
X-GuardRail-Source:    homehaat
X-GuardRail-Timestamp: 1760000000            (unix seconds)
X-GuardRail-Nonce:     random 16+ bytes, hex
X-GuardRail-Signature: hex( HMAC-SHA256( secret, "v1:" + timestamp + ":" + nonce + ":" + rawBody ) )
```

GuardRail **rejects** (and never says which check failed beyond "unauthorized"): unknown source, missing headers,
bad signature (constant-time compare with `crypto.timingSafeEqual`), timestamp more than **5 minutes** off, a
nonce already used (unique `(source, nonce)` in Postgres = **replay protection**), body over 64 KB, or a body that
fails the Zod schema. Batches of up to 50 events per request. Ingest is rate-limited per source.

### Never slow down or break HomeHaat / Oppora
- Events are sent **after** the response is ready, off the request path (HomeHaat: a background thread; Oppora:
  the platform's "after response" hook), with a **2-second timeout**.
- **Every error is swallowed** and logged, never shown to the user. If GuardRail is down, events go to a small
  outbox table (capped, e.g. 5,000 rows) and are **retried later** by the scheduled job that already exists; oldest
  dropped first if it's full.
- **Kill switch:** `GUARDRAIL_ENABLED=false` (or no URL / secret set) turns sending off completely.
- Only allow-listed fields are sent; passwords, tokens, card data and full emails never leave the site.
- Tests in each site prove: a GuardRail timeout or 500 doesn't change the user's response, and a sign-in still
  works with GuardRail switched off.

---

## 7. Real-time — Server-Sent Events on Vercel Hobby

`GET /api/stream` is an SSE stream (`text/event-stream`). Serverless instances don't share memory, so the stream
**polls Postgres** for rows newer than the last id it sent (every ~2 s, one indexed query), and **closes itself
after ~50 s**, well under Vercel's 300 s limit. The browser's `EventSource` reconnects automatically and sends
`Last-Event-ID`, so nothing is missed or duplicated. A heartbeat comment keeps proxies from closing it. If the
stream fails, the dashboard falls back to polling and shows "Live" / "Reconnecting…" honestly. (No paid
pub/sub service needed; Neon only stays awake while the dashboard is open.)

---

## 8. Pages

**Public**
- `/` — 3D landing page (Stage 6): Three.js globe, attacks fly from their **country** to my servers, flash when
  blocked; high alerts travel to India; floating glass panels with depth; 3D flip cards "What it catches" (one per
  MITRE rule). Real events (country only) or simulated in demo mode. Static fallback image + no animation for
  `prefers-reduced-motion`; lazy-loaded so phones stay fast. (Stage 1: a simple placeholder home page.)
- `/demo` — "Try the demo": the full dashboard, **read-only**, with fake data, labelled "Demo data" everywhere.
- `/signin` (+ 2FA step), `/setup-2fa` (first sign-in only).

**Dashboard (signed in, 2FA passed)**
- `/dashboard` — Overview: StatCards (events 24 h, open alerts by severity, sources online, blocked/failed logins),
  events-over-time chart, top IPs (masked in screenshots/demo), latest alerts, live event feed.
- `/dashboard/events` — live list, filter by source / type / time, search, pagination.
- `/dashboard/alerts` — list with severity / status filters, search, pagination.
- `/dashboard/alerts/[id]` — incident detail: summary, MITRE link, timeline, related events, notes, status buttons.
- `/dashboard/sources` — HomeHaat / Oppora: last seen, events today, setup instructions (names of env vars only).
- `/dashboard/upload` — upload an nginx/apache access log or Linux `auth.log` (≤ 5 MB) → parsed in the server →
  same rules → summary of what was found.
- `/dashboard/settings` — account, 2FA status, sign out everywhere.

**Typed API:** all routes under `/api/*`, Zod-validated in and typed out; the frontend calls them only through
`lib/api/*` typed functions.

---

## 9. Attack simulator (Stage 3)

`npm run simulate -- --target homehaat --scenario brute-force` sends realistic attack traffic to my **local**
HomeHaat (http://localhost:8000) and later Oppora: brute force, credential stuffing, scanning `/wp-admin` and
`/.env`, a flood, forged Razorpay webhooks, a login from a "new" IP. It **refuses any host that isn't `localhost` /
`127.0.0.1`**, prints what it did, and the resulting alerts appear in GuardRail live.

---

## 10. Definition of done (every stage)

Lint + type-check + unit tests pass; Playwright tests pass from Stage 2; no secret in git; `CLAUDE.md` updated
with How it works + 3 interview Q&As; committed and pushed; summary posted; stop.

---

## 11. Build order: 7 stages, one at a time

**Stage 1: Setup, local DB, sign-in with 2FA, dashboard shell, GitHub repo**
Next.js + TypeScript strict + Tailwind tokens + fonts, Docker Postgres (5434), Drizzle schema + migrations
(`admin_user`, `session`, `auth_attempt`), `start-guardrail.ps1` + `Start GuardRail.bat`, `admin:create`, sign-in
(password → 2FA), 2FA setup with QR, login rate limit, sessions, security headers with nonce CSP, dashboard shell
(sidebar / phone menu, Overview with empty states, placeholder pages), Vitest + Playwright set up with a first
end-to-end sign-in test on the throwaway database, private GitHub repo `guardrail`.
- **[KEY LOGIC]** `lib/auth/totp.ts` (TOTP codes + check with ±1 step and no reuse), `lib/auth/password.ts`
  (Argon2id hash/verify, strength rule), `lib/auth/session.ts` (create / read / end sessions, token hashing),
  `lib/auth/rate-limit.ts` (login limit), `lib/crypto.ts` (AES-256-GCM for the TOTP secret).

**Stage 2: Ingest API with HMAC signing + live events list**
`source` + `event` tables, `POST /api/ingest`, `/api/stream` (SSE), `/dashboard/events` live list with filters,
search and pagination, a small `npm run send-test-event` script.
- **[KEY LOGIC]** `lib/ingest/verify.ts` (signature, timestamp window, nonce replay), `lib/ingest/schema.ts`
  (Zod event schema + masking), `app/api/stream/route.ts` (SSE with Last-Event-ID).

**Stage 3: HomeHaat sends events (local first) + attack simulator**
A small `guardrail` app in HomeHaat's backend: signed client, background send, 2 s timeout, outbox + retry in
the existing scheduled job, kill switch; hooks for sign-in, admin sign-in, password reset, rate limits,
Razorpay webhook signature failures, payment failures, refunds, suspicious paths, permission denied, new device.
HomeHaat's full test suite must still pass. Then the attack simulator (localhost only).
- **[KEY LOGIC]** HomeHaat `guardrail/client.py` (sign + send + swallow + outbox), the simulator's localhost guard.

**Stage 4: Detection rules + alerts + email**
The six rules in Section 5, alert grouping, statuses, notes, incident timeline, `/dashboard/alerts` and
`/dashboard/alerts/[id]`, Resend email for High (capped).
- **[KEY LOGIC]** `lib/detection/rules/*.ts` (each rule + tests with fixed event lists), `lib/detection/engine.ts`
  (run rules, group into alerts), `lib/alerts/notify.ts` (email with daily cap).

**Stage 5: Oppora sends events**
Same pattern as HomeHaat, adapted to Oppora's stack. Small, additive, its tests still pass.

**Stage 6: Charts, incident timeline polish, log upload, demo mode, 3D landing page, tests**
Recharts events-over-time + top IPs, log parsers (nginx/apache combined format, `auth.log` sshd lines), `/demo`
read-only with fake data, the 3D landing page, IP 30-day wipe job, Lighthouse pass, more Playwright tests
(sign-in, live event appears, alert status change, demo is read-only, keyboard-only navigation).
- **[KEY LOGIC]** `lib/logs/parse-*.ts` (parsers + tests), the demo-mode guard (demo can never write).

**Stage 7: Deploy + connect live sites + README**
Neon + Vercel (step-by-step `docs/deploy.md` for Windows), a free scheduled job (Vercel Cron on Hobby, or GitHub
Actions) for the IP wipe, set HomeHaat/Oppora env vars on Render/Vercel, verify one real event end to end, then
`README.md` with screenshots, architecture diagram, **"Web development highlights"** and **"Security
highlights"**, a 2-minute demo script, and **"Interview notes"** collected from every stage.

**Start now with Stage 1 only. Stop when it's done and summarise.**
