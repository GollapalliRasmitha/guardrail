# GuardRail: project notes

A mini SIEM: a security monitoring dashboard for Rasmitha's two live sites, **HomeHaat** and **Oppora**. They send
HMAC-signed security events; GuardRail runs MITRE ATT&CK-mapped detection rules, raises alerts and shows everything
live. Full brief and stage plan: `PROMPT.md`. Next.js 16 notes for agents: `AGENTS.md` (read the bundled docs in
`node_modules/next/dist/docs/` before using a Next.js API; this version differs from older ones).

**Current stage: 6 of 7 done — charts, log upload, 30-day IP wipe, public read-only demo, 3D landing page, 35
end-to-end tests. Next: Stage 7 (deploy to Vercel + Neon, connect the live sites, README, screenshots). Waiting for
"continue". HomeHaat's and Oppora's GuardRail commits stay LOCAL (not pushed) until Stage 7: pushing either
redeploys a live site (Rasmitha: "wait until Stage 7").**

---

## How we work (short version of PROMPT.md section 0)

- One stage at a time. After each: `npm run check` (lint + types + unit tests) and `npm run test:e2e`, commit
  `stage-N: …`, push to GitHub (`origin` = https://github.com/GollapalliRasmitha/guardrail, private, branch `main`),
  summary + 3 interview Q&As, **stop**.
- **[KEY LOGIC]**: tests first, then code, then a plain-English explanation in "How it works" below.
- Rasmitha doesn't write code. Keep code short, named clearly, with comments on the tricky lines.
- **Free only.** Ask before anything that costs money, a new service/tool, a design-token change, or a breaking
  data-model change.
- Real data only in the real dashboard: unknown = "—" + a note, never a made-up number. Fake data only in demo mode
  (Stage 6), labelled "Demo data".

### Safety rules (always win)

- **Never ask Rasmitha to paste a secret in chat.** Say which variable name to set and where; she types the value.
- `.env` is never committed (it's in `.gitignore`); only `.env.example` with empty values. Check `git status`
  before every push.
- **Deleting data:** only after proving the target is the throwaway database `guardrail_e2e` on localhost. Scripts
  call `assertThrowaway()` (`lib/safety.ts`); shell commands run `npm run throwaway-check &&` first.
- Changes to HomeHaat/Oppora: small, additive, tested, never slow them down or break them; their own test suites
  must still pass.
- The attack simulator (Stage 3) attacks **localhost only**, never the live sites.

## Commands

```powershell
.\start-guardrail.ps1          # or double-click "Start GuardRail.bat": Docker Postgres, .env, packages, migrations, app window
npm run dev                    # the app on http://localhost:3100
npm run admin:create           # make the ONE account (or change its password); typed in the terminal, hidden
npm run admin:reset-2fa        # lost phone: turn 2FA off, sign out everywhere
npm run check                  # lint + type-check + unit tests (Vitest)
npm run test:e2e               # Playwright: starts its own copy on :3101 with the throwaway DB guardrail_e2e
npm run db:generate            # after changing lib/db/schema.ts: writes a new SQL migration into drizzle/
npm run db:migrate             # applies migrations to DATABASE_URL
npm run throwaway-check        # exits with an error unless DATABASE_URL is guardrail_e2e on localhost
npm run send-test-event        # signed test event(s) to the LOCAL app; options: --source oppora --type suspicious_path
                               #   --count 5 --replay --bad-signature --stale  (refuses any non-localhost APP_URL)
npm run connect:homehaat       # writes GUARDRAIL_* (+ a local PROXY_SECRET / RAZORPAY_WEBHOOK_SECRET if empty) into
                               #   ../homehaat/.env; values never printed; then restart HomeHaat
npm run connect:oppora         # same for ../Oppora/.env (+ a local CRON_SECRET if empty); then restart Oppora
npm run simulate               # attacks LOCAL HomeHaat (Django :8000): brute-force, stuffing, scan, flood, forged-webhook
                               #   --scenario <one> --target http://localhost:8000 (refuses anything not localhost)
npm run simulate -- --site oppora   # attacks LOCAL Oppora: scan, flood, forged-callback, cron-guess
```

**Local run:** start GuardRail (3100) and the site (Django 8000; HomeHaat and Oppora both use 8000, so one at a time,
or start one on another port and pass `--target`), run `npm run connect:<site>` once (and restart the site), then
`npm run simulate [-- --site oppora]`; the events appear live on /dashboard/events. Oppora's rate limits need its
Redis running (`docker start oppora-redis-1`, or its start script); without it they let everything through.

**Ports:** Postgres **5434** (HomeHaat 5433, Oppora 5432), app **3100**, end-to-end copy **3101**. All three
projects can run at the same time.

## Folder structure

```
guardrail/
  app/                      Next.js App Router
    layout.tsx              fonts (Chakra Petch / IBM Plex Sans / IBM Plex Mono), reads headers() so every page
                            renders per request (needed for the CSP nonce)
    globals.css             design tokens (CSS variables -> Tailwind names), .grid-ground, .eyebrow, .input
    page.tsx                public home: hero + 3D globe (HeroGlobe), six flip cards, "How it works", demo links
    signin/, setup-2fa/     sign-in (password -> code) and first-time 2FA setup
    dashboard/              layout.tsx (requireActiveSession + AppShell), page.tsx (Overview), events/, alerts/,
                            sources/, upload/, settings/, loading.tsx (skeleton), error.tsx (retry)
    demo/                   public read-only demo: layout (banner + DemoLiveProvider), page, events/, alerts/, alerts/[id]
    api/auth/               signin, 2fa/verify, 2fa/setup (+ confirm), signout, signout-all
    api/ingest/             POST: signed events from HomeHaat/Oppora [KEY LOGIC order of checks]
    api/stream/             GET: Server-Sent Events live feed [KEY LOGIC]
    api/events/             GET: a page of events, or ?after= (the live feed's polling fallback)
    api/health/             liveness, no database
    api/logs/analyze/       POST: a log file (plain text, ≤ 4 MB) → findings; nothing stored [KEY LOGIC]
    api/cron/retention/     GET: daily clean-up, Bearer CRON_SECRET (Vercel Cron, vercel.json)
    api/public/attacks/     GET, public: country totals for the globe (≥ 3 per country, no IPs), cached 60 s
    not-found.tsx, icon.svg
  components/
    Logo.tsx                shield mark + wordmark
    ui/                     Button (+ buttonClass for Links), Panel, StatCard, EmptyState, SeverityBadge, LiveDot,
                            Mono, FormError
    shell/                  AppShell (+ PageHeader), NavLinks, MobileNav (<dialog>), SignOutButton, nav.ts
    auth/                   AuthCard, SignInForm, SetupTwoFactor, CodeField
    settings/               SignOutEverywhere
    live/                   LiveProvider (ONE shared SSE connection + polling fallback + pause when hidden), LiveStatus
    events/                 EventList (table on md+, cards on phones), LiveEventList (grows live, keeps filters),
                            EventBadges (EventTypeBadge, SourceBadge), EventFilterBar (GET form), SourceStatus
    ui/Pagination.tsx       Newer / Older links that keep the filters (noun: "events" / "alerts")
    events/PathText.tsx     a path that wraps only after "/", long segments shortened, full path on click/tap/Enter
    alerts/                 AlertList (links; one layout for phone + desktop), AlertFilterBar (GET form), StatusBadge,
                            AlertActions (status buttons), NoteForm, Timeline (plain-words incident timeline)
    live/RefreshOnEvents.tsx  re-renders server pages ~2.5 s after live events (alerts appear without reload)
    live/DemoLiveProvider.tsx the demo's fake live feed (same context as LiveProvider; no network)
    charts/                 EventsChart (hand-drawn SVG stacked bars, hover/keyboard tooltip, table view), TopIps
    views/                  OverviewView, IncidentView: one layout for the dashboard AND the demo (base="/dashboard"|"/demo")
    logs/                   LogUpload (site, file / drop / sample), LogResults (what was read + one card per attack)
    landing/                HeroGlobe (picks 3D or still, feed, glass panels), Globe (Three.js, lazy), StaticGlobe (SVG),
                            FlipCard (button, aria-pressed)
  lib/
    env.ts                  every setting, validated with Zod (fails loudly, never prints values)
    db/schema.ts            Drizzle tables: admin_user, session, auth_attempt
    db/index.ts             db() / pool(): lazy, one pool per process
    crypto.ts               randomToken, sha256Hex, hmacHex, privacyHash, AES-256-GCM [KEY LOGIC]
    auth/totp.ts            TOTP (RFC 6238) written by us [KEY LOGIC]
    auth/password.ts        Argon2id + strength rule + dummy-hash timing [KEY LOGIC]
    auth/session-rules.ts   pure session lifetimes [KEY LOGIC]
    auth/session.ts         cookie + session table: create / read / end / upgrade [KEY LOGIC]
    auth/rate-limit.ts      login limit: pure checkLimit + database counts [KEY LOGIC]
    auth/two-factor.ts      setup secret, check code + mark step used + upgrade session
    auth/code-route.ts      shared handler for 2fa/verify and 2fa/setup/confirm
    auth/guards.ts          requireActiveSession() for every dashboard page
    http/request.ts         jsonError, sameOrigin (CSRF), clientIp, readJson
    validation/auth.ts      Zod request bodies + response types, shared by API and pages
    api/client.ts, auth.ts  the ONLY place the frontend calls fetch (typed)
    dashboard/overview.ts   Overview numbers (events 24 h, sources online, failed sign-ins, signed-in devices)
    events/types.ts         SOURCES, EVENT_TYPES (+ labels/tones), META_KEYS allow-list — the shared vocabulary
    events/filters.ts       URL filters (Zod), filtersToQuery, matchesFilters (same rules live as in SQL), EventView
    events/query.ts         listEvents (filters, search, pages), eventsAfter(cursor), latestEventId, sourceStats
    ingest/signature.ts     signRequest / verifySignature: HMAC-SHA256 + 5-minute window [KEY LOGIC]
    ingest/schema.ts        parseBatch: per-event Zod checks, maskActor, path without query, meta allow-list [KEY LOGIC]
    ingest/store.ts         secretFor, claimNonce (replay), recentRequestCount (rate limit), insertEvents
    live/sse.ts             sseMessage, sseComment, parseCursor [KEY LOGIC]
    api/events.ts           typed eventsAfter() for the polling fallback
    format.ts               formatTime (IST, same on server and browser), formatCount (Indian grouping)
    safety.ts               assertThrowaway()
    simulator/target.ts     assertLocalTarget (localhost only, URL-parsed) + testNetIp (documentation IPs) [KEY LOGIC]
    events/path-parts.ts    pathParts: split a path after each "/", shorten very long segments (+ test)
    detection/rules.ts      the six rules as pure functions + MITRE mapping + advice [KEY LOGIC]
    detection/engine.ts     detect(eventIds): rules → findings → alerts; runs in after() [KEY LOGIC]
    alerts/types.ts         SEVERITIES, ALERT_STATUSES, RULE_IDS, ACTIVITY_KINDS
    alerts/store.ts         upsertAlert (one active alert per attack), changeStatus, addNote, timeline merge [KEY LOGIC]
    alerts/status.ts        allowed status moves + button labels (+ test)
    alerts/email.ts         emailDecision (high only, once, daily cap) + buildAlertEmail (no IPs) [KEY LOGIC]
    alerts/notify.ts        sends via Resend's HTTP API, claims emailed_at first, outcome on the timeline
    alerts/filters.ts, query.ts  alert list filters (URL) + listAlerts / alertDetail / activeAlertCounts
    auth/api-guard.ts       guardChange(): Origin check + active session for dashboard API changes
    validation/alerts.ts    statusBody, noteBody, alertId
    dashboard/buckets.ts    hourlyBuckets (24 IST hours, zero-filled), firstBucketStart, niceMax (+ test)
    dashboard/charts.ts     eventsPerHour, topIps (grouped by ip_hash)
    logs/parse.ts           parseLine: nginx/Apache access logs + auth.log (sshd) → events [KEY LOGIC]
    logs/analyze.ts         analyzeLog / analyzeEvents: the SAME rules, in memory, one finding per attack [KEY LOGIC]
    validation/logs.ts      MAX_LOG_BYTES (4 MB), response types
    retention-rules.ts      retentionCutoffs, bearerMatches (pure + test); retention.ts runs the clean-up [KEY LOGIC]
    demo/random.ts          seeded random (mulberry32), demo people / attacker countries / scanner paths
    demo/world.ts           demoWorld(now): a made-up day, alerts from the real rules [KEY LOGIC]; request.ts caches it
    demo/live.ts            one fake live event
    public/feed.ts          publicFeed: what the public globe may see [KEY LOGIC]
    geo/countries.ts, sphere.ts   country centres, servers (Singapore) + owner (India); lat/lon → 3D, arc height
    landing/attacks.ts      nextAttack (live: weighted by real totals; simulated: fixed list), ARC_MS
  scripts/                  migrate, admin-create, admin-reset-2fa, throwaway-check, send-test-event, prompt,
                            simulate (per-site attack scenarios), connect (writes a site's local .env: --site)
  e2e/                      Playwright, run in file order: 01-auth, 02-ingest, 03-live, 04-alerts, 05-charts, 06-upload,
                            07-retention, 08-demo, 09-landing, 99-lockout (locks sign-in, so last); fixtures.ts (test
                            values), helpers.ts (signInAsAdmin, sendSigned), global-setup.ts (resets guardrail_e2e,
                            warms up every page and API route so dev-mode compiling never hits a 5 s wait)
  public/samples/           access.log + auth.log samples for Log upload (documentation IPs only)
  vercel.json               daily cron → /api/cron/retention (21:30 UTC = 03:00 IST)
  drizzle/                  SQL migrations (committed)
  proxy.ts                  per-request CSP with nonce (Next 16 "proxy" = old "middleware")
  next.config.ts            security headers, distDir switch for e2e, typedRoutes
  docker-compose.yml        Postgres 17 on 127.0.0.1:5434; docker/initdb creates guardrail_e2e
  start-guardrail.ps1, "Start GuardRail.bat", .env.example, PROMPT.md, CLAUDE.md, AGENTS.md
```

## Design system ("security control room")

Tokens live only in `app/globals.css` and are used through Tailwind names (`bg-panel`, `text-muted`, `border-line`,
`text-accent`, `text-sev-high`, `font-display`, `font-mono`…). Never raw hex in components.

| Token | Value | | Token | Value |
|---|---|---|---|---|
| --ground | #070D1A (page) | | --accent | #6FD3C5 (teal) |
| --panel | #0D1628 (cards) | | --accent-ink | #052520 (text on teal) |
| --panel-2 | #12203A (hover) | | --sev-high | #FF6B6B (red) |
| --line | #1E2E4A (borders) | | --sev-medium | #F5B74E (amber) |
| --text | #E6EDF7 | | --sev-low | #5EA3FF (blue) |
| --muted | #8EA2C0 | | --ok | #4ADE80 |
| --chart-homehaat | #2BA89A (chart series) | | --chart-oppora | #8B6CEF (chart series) |

The two chart colours (Stage 6) passed the dataviz palette checks on `--panel` in dark mode (lightness band, chroma,
colour-blind separation, contrast). Series colour follows the site, never its rank. Home page extras: `.glass`
(frosted panel), `.float` (gentle drift), `.flip` / `.flip-inner` / `.flip-back` (card turn).

Fonts: **Chakra Petch** (`font-display`: headings, big numbers), **IBM Plex Sans** (body), **IBM Plex Mono**
(`font-mono`: IPs, times, IDs, codes, MITRE IDs, `.eyebrow` labels). Loaded with `next/font/google` (self-hosted).

Rules: severity = colour + word + icon (`SeverityBadge`); 44px touch targets (`min-h-11`); one teal focus ring
everywhere (`:focus-visible`); skip link in AppShell; `prefers-reduced-motion` turns animation off; every page has
loading (`loading.tsx`), empty (`EmptyState`) and error (`error.tsx`) states.

## Pages

| URL | What |
|---|---|
| `/` | public home: hero + 3D globe (attacks fly to Singapore, flash when blocked, high alerts hop to India; real country totals or labelled "Simulated"), six flip cards, How it works, Try the demo |
| `/demo`, `/demo/events`, `/demo/alerts`, `/demo/alerts/[id]` | public, read-only, "Demo data." banner on every page; fake live feed; status/note controls replaced by a note |
| `/signin` | step 1 email + password (show/hide), step 2 the 6-digit code; refresh keeps you on step 2 |
| `/setup-2fa` | first sign-in only: QR + typed key + confirm code |
| `/dashboard` | Overview: 4 StatCards, Events over time (24 IST hours, stacked by site, table view), Busiest IPs (24 h), Live events (latest 8), Open alerts, Sources, Your account |
| `/dashboard/events` | filter bar (source, event type, search IP/account/path; a GET form → URL), live list (page 1 grows live; later pages show "N new events"), pagination 25/page |
| `/dashboard/sources` | per site: secret set or not (never the value), last event, events 24 h, how it sends |
| `/dashboard/alerts` | filters (status: open + acknowledged by default / open / acknowledged / resolved / all; severity; source) in the URL, list of alerts (severity, status, MITRE id, title, site, events, last seen), 20 per page, refreshes itself when events arrive |
| `/dashboard/alerts/[id]` | incident: badges, title, rule description, What to do (advice + status buttons), Evidence (linked events), Details (MITRE link, subject, first/last seen), Timeline + Add a note |
| `/dashboard/upload` | Log upload: choose the site, a file (or drop one, or a sample), Analyse → what was read + one card per attack (severity, MITRE, events, first/last seen, line numbers) |

The sidebar's Alerts link shows the open-alert count. Overview: "Open alerts" card (n high · n medium · n low) and an
"Open alerts" panel. The Overview and incident page stack their columns below 1536px wide (2xl) so tables stay wide.
| `/dashboard/settings` | account, 2FA status, password/2FA commands, Sign out everywhere (with confirm) |

## API (all JSON; errors are `{ error: { code, message, retryAfterSec? } }`)

| Route | What |
|---|---|
| `POST /api/auth/signin` | `{email, password}` → `{next: "code" \| "setup-2fa"}` + short "password only" session cookie. 401 `wrong_credentials`, 429 `rate_limited` |
| `POST /api/auth/2fa/verify` | `{code}` → `{next: "dashboard"}` + new full session. 401 `wrong_code` / `no_pending_signin`, 429 |
| `POST /api/auth/2fa/setup` | → `{qrDataUrl, secret, account}` (only while 2FA is off) |
| `POST /api/auth/2fa/setup/confirm` | `{code}` → turns 2FA on + full session |
| `POST /api/auth/signout`, `/signout-all` | end this / every session |
| `POST /api/ingest` | server-to-server. Headers `X-GuardRail-Source`, `-Timestamp` (unix s), `-Nonce` (32–128 hex), `-Signature` (hex HMAC-SHA256 of `v1:ts:nonce:body`). Body `{events: [1..50]}`. → 202 `{accepted, rejected: [{index, reason}]}`. 401 `unauthorized` (any auth failure, same message), 400 `invalid_json` / `invalid_batch`, 413 `too_large` (>64 KB), 429 (>600 req/min per source) |
| `GET /api/stream` | SSE (signed in). `?after=<id>` or `Last-Event-ID`; messages `event: events` with `EventView[]`; closes after ~50 s |
| `GET /api/events` | signed in. `?source&type&q&page` → `{events, total, page, pages}`; `?after=<id>` → `{events, cursor}` |
| `POST /api/alerts/[id]/status` | `{status}` → `{status}`. 409 `not_allowed` (move not allowed) / `newer_open_alert` (reopen while a newer alert for the same attack is open), 404 |
| `POST /api/alerts/[id]/notes` | `{note}` (1–2000 chars) → `{ok}` |
| `GET /api/health` | `{ok: true}`, no database |
| `POST /api/logs/analyze?source=` | signed in + Origin. Body = the file (text/plain, ≤ 4 MB) → `{lines, formats, unreadable, events, byType, firstAt, lastAt, findings}`. 413 `too_large`, 400 `compressed` (.gz) / `binary` / `empty` / `unknown_format` |
| `GET /api/cron/retention` | `Authorization: Bearer <CRON_SECRET>` → `{ipsWiped, alertsWiped, sessionsDeleted, attemptsDeleted, noncesDeleted}`; 401 otherwise (always, when no secret is set) |
| `GET /api/public/attacks` | public → `{mode: "live" \| "simulated", total, highAlerts, countries: [{code, lat, lon, attacks}]}`, `Cache-Control: public, max-age=60` |

`/api/ingest` now answers `{accepted, duplicates, rejected}`: `duplicates` = events whose `uid` this site already
sent (a retry), skipped. Every browser POST checks `Origin` (403 `bad_origin` otherwise). `/api/ingest` has no cookies and is checked by
its signature instead.

**Event fields** (all optional except `type`, `occurred_at`): `uid` (32 hex: the sender's id for the event,
kept through retries), `actor_id` (16–64 hex: the sender's keyed hash of the full email), `ip` (v4/v6), `actor`, `path`, `method`,
`status_code`, `user_agent`, `country` (2 letters), `meta` (only keys in `META_KEYS`). Types: `login_failed`,
`login_success`, `admin_login`, `password_reset_requested`, `password_reset_done`, `rate_limited`,
`webhook_signature_failed`, `payment_failed`, `refund_issued`, `suspicious_path`, `permission_denied`,
`new_device_login`.

## Decisions and assumptions

- **Next.js 16.4, Cache Components OFF** (`cacheComponents: false`). Every dashboard page is live per-request data,
  and the nonce CSP needs per-request rendering. Root layout calls `headers()` to make that explicit.
- **Drizzle ORM + `pg`** (not Prisma): typed, close to SQL, no binary engine, works with Neon over TLS.
  `db()` is lazy so `next build` and unit tests don't need a database.
- **TOTP written by us** on Node `crypto` (not a library), tested against the RFC 6238/4226 vectors. QR via `qrcode`.
- **2FA setup happens at first sign-in** (forced before the dashboard opens). Small risk window: between
  `admin:create` and the first sign-in, someone with the password could enrol their own phone. Mitigation: run
  `admin:create` and sign in right away; once 2FA is on, it can only be reset from the terminal (`admin:reset-2fa`).
- **Cookie `SameSite=Lax`** (not Strict, as PROMPT.md first said) so the link in an alert email opens the dashboard
  while signed in. CSRF is still blocked: every POST checks `Origin`.
- **Cookie name** `__Host-guardrail_session` online, `guardrail_session` locally (the `__Host-` prefix needs HTTPS).
  Different name from HomeHaat/Oppora cookies, so localhost ports don't collide.
- **Client IP:** on Vercel `x-real-ip` (set by Vercel, can't be faked); locally always `"local"`. IPs and emails are
  stored only as keyed hashes (`privacyHash`) in `auth_attempt` / `session`.
- **Blocked sign-in tries aren't recorded**, so an attacker can't keep the account locked forever; the lock ends 15
  minutes after the attacker stops.
- **CSP:** scripts need the per-request nonce (`'strict-dynamic'`); styles allow `'unsafe-inline'` (React `style`
  props and chart libraries need it; CSS can't run code). Dev adds `'unsafe-eval'` (React dev tools only).
- **npm 12 blocks install scripts by default.** esbuild/unrs-resolver warnings are expected and harmless (their
  platform binaries come as normal packages).
- `@types/node` is pinned to v24 to match Node 24 (Vitest 5 needs ≥22).
- Playwright reuses the Chromium already installed for HomeHaat (`%LOCALAPPDATA%\ms-playwright`, revision 1248).
- **No `source` table** (PROMPT.md first had one): the two sites are a fixed list in `lib/events/types.ts`, secrets
  are env vars, and "last seen" comes from `max(event.received_at)`. Less to keep in sync.
- **One nonce per request, not per event** (`ingest_nonce` table), since a request carries up to 50 events.
- **Per-event validation:** a badly shaped batch → 400; inside a good batch, bad events are listed in `rejected` and the
  good ones are stored. So one broken event can't make the sender retry (and fail) forever. Senders retry only on
  network errors / 5xx, never 4xx (Stage 3).
- **Events up to 7 days old** are accepted (the sender's outbox may deliver late); more than 5 minutes in the future
  is refused.
- **SSE checks the session once per connection** (each lasts ≤ 50 s), so a sign-out stops the feed within 50 s.
- **The live feed pauses while the tab is hidden** (`visibilitychange`), so a forgotten tab doesn't keep Neon awake.
- `.env` gained `INGEST_SECRET_HOMEHAAT` / `INGEST_SECRET_OPPORA`; `start-guardrail.ps1` now adds any missing setting
  to an existing `.env` with a random value.
- Test IPs come from ranges reserved for documentation (`203.0.113.x`, `198.51.100.x`), never real people.
- **HomeHaat's side (Stage 3) lives in the homehaat repo:** `backend/guardrail/` (client, signals, middleware,
  OutboxEvent) + one-line `report(...)` calls in `payments/views.py` and `payments/refunds.py`, a `guardrail` job in
  `core/jobs.py` (also added to the hourly GitHub Actions run), `core/client_ip.client_country`, and
  `frontend/proxy.ts` passes Vercel's `x-vercel-ip-country`. HomeHaat has no password reset, so it never sends
  `password_reset_*`; `new_device_login` is left to GuardRail's T1078 rule (Stage 4), which compares IPs per account.
- **Scanner paths on the live site:** Vercel serves HomeHaat's pages and only `/api/*` reaches Django, so
  `suspicious_path` covers scans of the API and of the Render address directly. Scans of page URLs on Vercel aren't
  seen (a later improvement could report them from `frontend/proxy.ts`).
- **Detection runs in Next.js `after()`**, once the ingest answer has been sent: the sender's 2-second timeout covers
  storing events only, never rules or email.
- **`actor_id`** (Stage 4): masked emails collide (`victim@` and `vivek@` are both `vi****@`), so per-account rules
  use a keyed hash of the full email that the sender computes (HomeHaat: HMAC-SHA256 with `GUARDRAIL_SECRET`, first
  32 hex). GuardRail never sees the email. Without it, rules fall back to the masked email (less precise).
- **`uid` + unique (source, uid)** (Stage 4): found in a real test, when a slow first answer made HomeHaat retry a
  batch GuardRail had already saved. Now retries can't duplicate (at-least-once sending + de-duplication).
- **Titles never contain counts from a time window** (they could shrink later); the event total is shown separately.
- **After an alert is resolved**, the engine ignores that group's events from before the resolve time, so one stray
  event can't instantly re-raise the attack you just closed.
- **Timeline merging:** "N more events" entries within 10 minutes are merged into one line.
- **Email is optional** (`RESEND_API_KEY`, `ALERT_EMAIL_TO`, optional `ALERT_EMAIL_FROM`, default Resend's test sender
  `onboarding@resend.dev`, which may only send to your own address). Not set → the timeline says so once per alert.
- **Two HomeHaat Django processes on one database share one outbox.** Only matters in testing (my test Django on
  8001 delivered events that Rasmitha's own Django on 8000 had queued); never an issue with one server per database.
- **Oppora's side (Stage 5) lives in the Oppora repo** (`backend/guardrail/`, local commit, not pushed): a copy of
  HomeHaat's sender adapted to Oppora. Oppora signs in with Google only (no passwords, no Django admin, no
  payments), so it sends `login_success`, `login_failed` (forged/invalid Google callbacks; never Cancel or timeout),
  `rate_limited`, `suspicious_path` and `permission_denied` (wrong scheduler secret, 403s for signed-in users). The
  shared **demo account is never reported** (recruiters from many IPs would raise false T1078 alerts). No country:
  Oppora has no proxy secret to trust one with. Resends: Celery Beat every 10 min + the hourly scheduler run.
- **The end-to-end copy blanks `RESEND_API_KEY` / `ALERT_EMAIL_TO` / `ALERT_EMAIL_FROM`** (playwright.config.ts and
  .claude/launch.json): Next.js also reads `./.env`, and once Rasmitha added her Resend key a test run tried to email
  her (Resend refused it with 403, so nothing was sent). An empty value counts as "already set", so `.env` can't
  fill it in. Found 21 Oct 2026; tests must never use real keys.
- **The copied sender is ~250 lines in two repos.** Kept as a copy on purpose (each site stays independent and
  deployable on its own); a shared pip package would be the next step if a third site ever joins.
- **No MITRE rule for Oppora's forged callbacks or scheduler-secret guesses yet:** they're visible as events but
  no rule turns them into alerts (they have no account to group by). A possible later rule.
- **Charts are hand-drawn SVG, not a chart library** (Stage 6): two small charts don't justify ~100 KB of Recharts;
  our own SVG uses the tokens directly, needs nothing from elsewhere, and gets a keyboard tooltip + table view.
- **Chart hours are India hours** (start at :00 IST). India is UTC+5:30 with no daylight saving, so a fixed offset is
  exact. The chart's query starts where its first bar starts (found by a unit test: events from the partial hour 24 h
  ago were being fetched and then not drawn).
- **Uploaded logs are never stored** (not even a summary): analysed in memory, the answer is the only copy. Limit
  4 MB because Vercel Hobby refuses request bodies over 4.5 MB. Classic auth.log lines have no year or time zone:
  read as UTC, and a date that would be in the future is put in the previous year.
- **sshd failures are counted once:** "Invalid user X" counts; the "Failed password for invalid user X" line that
  follows it is skipped (otherwise each try would count twice).
- **Retention:** raw IPs are wiped after 30 days (`ip_hash` stays, so counts and rules still work), and IP-based
  alert titles become "… from a wiped IP". Expired sessions, sign-in tries older than a day and nonces older than
  10 minutes are deleted. Runs daily from Vercel Cron with `CRON_SECRET` (the start script adds a random local one).
  It's an app feature, not something run by hand: there's no npm script for it, so it can't be pointed at the real
  database by mistake; the end-to-end test runs it only on `guardrail_e2e`.
- **Demo = same views, generated data, no database.** `OverviewView` / `IncidentView` are shared; the demo pages
  never import the database, so they can't show real data or change anything. A Playwright test records every
  request while clicking through the demo and expects zero POSTs. Fixed seed, so alert links stay valid.
- **Public globe data is aggregated:** only country totals of attack-type events (failed sign-ins, rate limits, scans,
  forged webhooks, 403s) over 24 h, countries with < 3 hidden, cached 60 s (visitors don't each wake Neon). With no
  real data it says "Simulated attacks" and makes them up. HomeHaat sends a country (Vercel header); Oppora doesn't.
- **Three.js + @react-three/fiber, no drei** (Stage 6): the globe needs only spheres, lines and points. It's loaded
  with `next/dynamic` (`ssr: false`) only when used; reduced motion or no WebGL → a still SVG globe and no download.
  It pauses when scrolled away or the tab is hidden, uses `dpr` ≤ 1.75 and fewer attacks on phones. The globe has
  no continents (no map data downloaded): a grid, a dot per country, the servers (Singapore, where both sites run
  on Render) and the owner (India).
- **The simulator fakes attacker IPs only through HomeHaat's own `PROXY_SECRET` header**, read from HomeHaat's local
  `.env` (never printed). Without it every request comes from 127.0.0.1. It signs in through Django's real CSRF flow
  and rate limits, so the events are exactly what a real attack would produce.

---

## How it works (read this before interviews)

### 1. TOTP 2FA codes — `lib/auth/totp.ts` [KEY LOGIC]

**What it does:** makes and checks the 6-digit codes from an authenticator app (Google Authenticator, Microsoft
Authenticator, 1Password).

**Step by step:**
1. At setup, GuardRail makes a random 20-byte (160-bit) **secret** and shows it as a QR code (`otpauth://totp/...`)
   plus typed text in **base32** (letters A–Z and digits 2–7, easy to type).
2. Both the phone and GuardRail compute: `step = floor(unix time / 30)` → **HMAC-SHA1(secret, step)** → take 4 bytes
   at an "offset" given by the last 4 bits ("dynamic truncation") → `% 1,000,000` → 6 digits, zero-padded.
3. To check a code, GuardRail tries the current step and **one step either side** (phone clocks drift a few seconds).
4. It **refuses any step ≤ the last used step**, so a code can't be used twice, even within its 30 seconds
   (replay protection). The accepted step is saved with a conditional `UPDATE … WHERE totp_last_step < step`, so two
   requests racing with the same code can't both win.
5. The compare uses `crypto.timingSafeEqual` (same time whatever the input).

**Why it's safe:** nothing secret travels at sign-in except a code that dies in 30 seconds and can be used once.
The secret is stored **encrypted** (section 5). Tests use the official RFC 6238 and RFC 4226 test vectors.

**Node features:** `crypto.createHmac("sha1")`, `Buffer.writeBigUInt64BE`, `timingSafeEqual`, bit operations.

> *Say it:* "TOTP is HMAC-SHA1 of the number of 30-second steps since 1970, truncated to 6 digits. I wrote it from
> the RFC and test it against the RFC's own vectors. I allow one step of drift, compare in constant time, and store
> the last used step so a code can't be replayed."

### 2. Passwords — `lib/auth/password.ts` [KEY LOGIC]

- **Argon2id** (`@node-rs/argon2`) with OWASP's settings: 19 MiB memory, 2 passes. It's **memory-hard**: each guess
  needs real RAM, so a GPU can't try billions per second like with MD5/SHA. Each hash has its own random salt
  stored inside the result (`$argon2id$v=19$m=19456,t=2,p=1$…`).
- **Strength rule** when setting it: 14–128 characters, no common passwords, enough different characters, not a
  simple sequence, not the email name. The 128 max stops someone sending a 1 MB "password" to burn CPU.
- **Same time for unknown emails:** `verifyPasswordOrDummy` runs Argon2 against a dummy hash when the email doesn't
  exist, and the message is always "Email or password is wrong." So nobody can learn which emails have accounts,
  either from the words or from the response time.

> *Say it:* "Passwords are hashed with Argon2id, the current OWASP recommendation, because it's memory-hard. Unknown
> emails still run a dummy hash, so the response time doesn't reveal whether an account exists."

### 3. Sessions — `lib/auth/session.ts` + `session-rules.ts` [KEY LOGIC]

**What it does:** remembers that this browser is signed in.

1. On sign-in, make a **random 256-bit token** (`randomToken`), put it in a cookie, and store only
   **SHA-256(token)** in the `session` table. A stolen database backup can't be turned back into a working cookie.
2. The cookie is `httpOnly` (JavaScript can't read it, so an XSS bug can't steal it), `Secure` online,
   `SameSite=Lax`, and online it's named `__Host-…` (the browser then refuses it unless Secure, Path=/, no Domain).
3. Two kinds of session: **password only** (`mfa_passed = false`, lives 10 minutes, can only submit a code) and
   **full** (12 hours max, signed out after 2 hours idle). `sessionState()` is a pure function that decides
   active / needs-2fa / expired, so it's unit-tested without a database.
4. When the code is right, the password-only session is **deleted and a brand-new token issued**
   (`upgradeSession`). A new token at every privilege step stops **session fixation**.
5. `last_seen_at` is updated at most every 5 minutes (sliding idle timeout without a write on every click).
6. Sign out deletes the row, so even a copied cookie is dead. "Sign out everywhere" deletes all rows.
7. **Every dashboard page and API route checks the session itself** (`requireActiveSession`), not just the
   layout: Next.js doesn't re-run a layout on every client navigation, so a layout-only check isn't enough.

> *Say it:* "Sessions are opaque random tokens in an httpOnly cookie; the database only stores their SHA-256. A
> password alone gives a 10-minute session that can only enter a 2FA code; the right code swaps it for a brand-new
> token, which prevents session fixation."

### 4. Login rate limit — `lib/auth/rate-limit.ts` [KEY LOGIC]

1. Every password or code try is saved in `auth_attempt` with a **keyed hash** of the IP and of the email (never the
   real values), whether it worked, and the time.
2. Before checking a password, count failures in the last **15 minutes**: **5 from this IP**, or **10 on this
   account from anywhere** → blocked with HTTP 429 and `Retry-After`.
3. `checkLimit(failures, limit, window, now)` is **pure** (no database): it takes the newest failures, and if
   `limit` of them are inside the window, the block lasts until the oldest of those leaves it. Unit-tested with fixed
   times.
4. The 2FA code step has its own limit; after too many wrong codes the half-signed-in session is thrown away.
5. **Blocked tries aren't recorded**, otherwise an attacker could keep me locked out forever by hammering the form.
   Rows older than a day are deleted at the next sign-in.

> *Say it:* "I rate-limit per IP and per account in Postgres with a sliding 15-minute window. IPs and emails are
> stored as HMACs. The per-account limit stops distributed guessing; not recording blocked tries means the lockout
> can't be extended forever."

### 5. Encrypting the 2FA secret — `lib/crypto.ts` [KEY LOGIC]

The 2FA secret must be readable by the server (to compute codes), so it can't be hashed; it's **encrypted** with
**AES-256-GCM** using `ENCRYPTION_KEY` (32 random bytes, only in `.env` / Vercel settings).
- A new random 12-byte IV every time (GCM must never reuse one with the same key).
- GCM adds an **auth tag**: if anyone changes even one bit, decryption fails instead of returning garbage.
- Stored as `v1.<iv>.<tag>.<ciphertext>`; the `v1` lets us change the format later.
- Someone with only the database gets ciphertext; they'd also need the key from the server's environment.

> *Say it:* "Secrets I must read back are encrypted with AES-256-GCM, which also detects tampering. Secrets I only
> need to compare, like passwords and session tokens, are hashed instead."

### 6. CSRF, CSP and security headers — `lib/http/request.ts`, `proxy.ts`, `next.config.ts`

- **CSRF:** every POST checks that `Origin` equals `APP_URL`. Browsers always send `Origin` on POST and a page on
  another site can't fake it. Plus `SameSite=Lax` cookies. A Playwright test sends `Origin: https://evil.example` and
  gets 403.
- **CSP with a nonce** (`proxy.ts`, Next 16's name for middleware): each page gets a fresh random nonce, and only
  `<script>` tags carrying it may run (`'strict-dynamic'` trusts what they load). An injected script has no nonce, so
  the browser refuses it. A test checks two requests get different nonces.
- **Other headers** on every response: `nosniff`, `frame-ancestors 'none'` + `X-Frame-Options: DENY` (no
  clickjacking), `Referrer-Policy`, `Permissions-Policy` (no camera/mic/location), HSTS online.

> *Say it:* "State-changing requests are checked against the Origin header, and pages ship a nonce-based Content
> Security Policy generated per request in the Next.js proxy, so injected scripts don't run."

### 7. The sign-in flow end to end

```
/signin  email+password ─► POST /api/auth/signin ─► rate limit ─► Argon2 ─► "password only" session (10 min)
   │                                                            ├─ 2FA off ─► /setup-2fa ─► QR ─► POST …/setup/confirm
   └─ code ─► POST /api/auth/2fa/verify ─► rate limit ─► TOTP + mark step used ─► new full session ─► /dashboard
```

### 8. The throwaway rule — `lib/safety.ts`

`assertThrowaway(url)` passes only for database `guardrail_e2e` on `localhost`/`127.0.0.1`. The Playwright setup
calls it before `TRUNCATE`; `npm run throwaway-check` does it for shell commands. Look-alike names and remote hosts
(like Neon) are refused, and tests prove it.

### 9. Signed event intake — `lib/ingest/signature.ts` + `app/api/ingest/route.ts` [KEY LOGIC]

**The problem:** `/api/ingest` is on the public internet. Anyone could POST "500 failed logins" to fill my
dashboard with junk, or replay a real request they captured.

**The answer: each site signs every request with its own secret.**
```
message   = "v1:" + timestamp + ":" + nonce + ":" + raw body
signature = hex( HMAC-SHA256(that site's secret, message) )
headers   = X-GuardRail-Source, X-GuardRail-Timestamp, X-GuardRail-Nonce, X-GuardRail-Signature
```
- **HMAC** = a hash that only someone holding the secret can produce. Change one byte of the body and the
  signature no longer matches.
- The **timestamp and nonce are inside the signed message**, so an attacker can't swap in a fresh timestamp or
  a new nonce without breaking the signature.
- **Each site has its own secret** (`INGEST_SECRET_HOMEHAAT`, `INGEST_SECRET_OPPORA`), so a leak at one site can't
  forge events for the other. A test signs an Oppora request with HomeHaat's secret and gets 401.
- `"v1"` lets us change the scheme later without confusing old and new.

**The route checks in this order** (cheap first; nothing is written until the signature is proven):
1. Known source? → else 401.
2. Body ≤ 64 KB (checked on `Content-Length` **and** the real body, because the header can lie) → else 413.
3. Headers well-formed, timestamp within **±5 minutes**, then HMAC compared with `timingSafeEqual` → else 401.
4. Rate limit: ≤ 600 requests a minute per source → else 429 (only reachable with a valid signature, so outsiders
   can't use up the budget).
5. **Nonce never seen before** (section 10) → else 401.
6. Parse JSON, validate and clean each event (section 11), store, return 202 `{accepted, rejected}`.

Every authentication failure returns the **same** `401 Unauthorized`, so an attacker can't tell whether the
signature, the clock or the nonce was wrong. A missing secret refuses everything (`no_secret`); it never means
"trust everything".

**Node features:** `crypto.createHmac("sha256")`, `timingSafeEqual`, `request.text()` (raw body before JSON).
The reference signature in the unit test was computed separately with Python's `hmac` module, so HomeHaat's Python
client (Stage 3) can be tested against the same value.

> *Say it:* "Every event batch is HMAC-SHA256-signed with a per-site secret over the timestamp, a nonce and the raw
> body. I check the signature in constant time on the raw bytes before parsing, refuse anything older than five
> minutes, and store each nonce so a captured request can't be replayed."

### 10. Replay protection with a nonce — `claimNonce` in `lib/ingest/store.ts` [KEY LOGIC]

The 5-minute window alone isn't enough: an attacker who captures a request could resend it within those 5 minutes.
So each request carries a random **nonce** ("number used once"), and GuardRail records it:
```sql
INSERT INTO ingest_nonce (source, nonce) VALUES (...) ON CONFLICT DO NOTHING RETURNING nonce
```
- `(source, nonce)` is the **primary key**, so Postgres itself refuses a second copy, **even if two copies arrive
  at the same instant** (no "check, then insert" race in our code).
- 1 row back = first time → continue. 0 rows = already used → 401.
- Nonces older than 10 minutes are deleted now and then: their timestamp is already outside the 5-minute window,
  so they couldn't be replayed anyway. The table stays tiny.

> *Say it:* "The timestamp limits a captured request to five minutes, and a unique (source, nonce) key in Postgres
> makes each request usable exactly once, safely even under concurrency."

### 11. Cleaning events, privacy first — `parseBatch` in `lib/ingest/schema.ts` [KEY LOGIC]

- **Zod** checks each event: known `type`, real ISO time, IPv4/IPv6, status code 100–599, lengths.
- **A bad shape** (`{events: "x"}`, empty, >50) refuses the whole batch with 400. **A bad event inside a good batch**
  is reported by index in `rejected`, and the others are stored, so one broken event can't block the rest.
- **Privacy, applied here even though the senders do it too** (defence in depth):
  - `actor` masked: `priya.sharma@example.com` → `pr****@example.com`.
  - `path` stored **without the query string**: `/reset/?token=…` → `/reset/` (reset links carry tokens).
  - `meta` keeps only allow-listed keys (`reason`, `limit`, `role`…): a `password` key is silently dropped.
  - `user_agent` cut to 200 characters; the IP is also stored as a keyed hash (`ip_hash`) so counting still works
    after the IP itself is wiped at 30 days (Stage 6).
- Times must be within the last 7 days and not more than 5 minutes ahead.

> *Say it:* "Validation is per event: a bad batch shape is a 400, but inside a batch I keep the good events and
> report the bad ones by index. Privacy rules run on the server too, so a sender's mistake can't store a full email
> or a reset token."

### 12. Real-time with Server-Sent Events on serverless — `app/api/stream/route.ts` + `LiveProvider` [KEY LOGIC]

**Why SSE:** the dashboard only needs server → browser updates. SSE is plain HTTP (`text/event-stream`), the browser
reconnects by itself, and it works on Vercel Hobby. WebSockets would need a separate paid service on Vercel.

**The serverless problem:** each request may run on a different machine with no shared memory, so "tell everyone
when an event arrives" isn't possible inside the app. Instead:
1. The browser opens `GET /api/stream?after=<newest id it already has>`.
2. Every 2 seconds the stream asks Postgres `WHERE id > cursor ORDER BY id LIMIT 100` (primary-key index, cheap).
   New rows are sent as `id: <last id>` + `event: events` + `data: [...]`.
3. A `: ping` comment every 15 seconds stops proxies closing a quiet connection.
4. After **~50 seconds the server closes the stream** (Vercel Hobby stops functions at 300 s). The browser's
   `EventSource` reconnects after 1 second (`retry: 1000`) and sends **`Last-Event-ID`**, so the next stream starts
   exactly where the last one ended: nothing missed, nothing twice.
5. **One connection per tab**: `LiveProvider` (in the dashboard layout) owns the `EventSource` and hands events to
   whoever subscribed (header dot, Overview feed, Events list).
6. **Fallback:** if the stream fails 3 times, or the server refuses it, the page asks `GET /api/events?after=` every
   5 seconds and the dot says "Live (polling)". A 401 sends you to sign-in.
7. **Hidden tab → disconnect** ("Paused"), reconnect and catch up when visible again. Saves battery and keeps Neon's
   free compute from running for a forgotten tab.
8. **The UI:** page 1 inserts matching events at the top with a short teal glow (none with reduced motion); later
   pages don't move rows under the reader and show "N new events · go to the newest" instead. Screen readers hear a
   short "3 new events" (`aria-live="polite"`) rather than every row. `matchesFilters` applies the same rules as the
   SQL query, so a live row never breaks the page's filters.

> *Say it:* "Real-time uses Server-Sent Events. Because serverless instances don't share memory, each stream polls
> Postgres by a cursor every two seconds and closes after fifty seconds; EventSource reconnects with Last-Event-ID,
> so it's gap-free and stays inside Vercel's free limits. One shared connection per tab, polling as a fallback, and
> it pauses when the tab is hidden."

### 13. Monitoring that can't hurt the site — HomeHaat `backend/guardrail/client.py` [KEY LOGIC]

**The rule:** HomeHaat's visitors must never wait for, or see an error from, GuardRail.

```
view / signal / middleware ─► report("login_failed", request, actor=email)   ← returns at once, never raises
                                   puts a small, already-masked event in an in-memory queue
background thread ─► batch of ≤50 ─► sign (HMAC) ─► POST /api/ingest, timeout 2 s
     ├─ 2xx            → done; also sends up to 100 waiting events from the outbox
     ├─ down / 5xx / 429 → saved in the OutboxEvent table (max 5,000, oldest dropped first)
     └─ other 4xx      → GuardRail refused them and would again → dropped + logged
scheduled job "guardrail" (hourly GitHub Actions → core/jobs.py) ─► flush_outbox()
```
- `report()` only builds the event and puts it in the queue, inside `try/except`. The network call happens in a
  separate background (daemon) thread.
- **Privacy at the source:** `build_event` masks the email, cuts the path at `?`, trims the user agent and keeps only
  allow-listed `meta`. GuardRail does it again (defence in depth).
- **Retries are safe:** each retry is a new signed request with a new nonce. `select_for_update(skip_locked=True)`
  means the job and the thread never send the same rows twice. Rows older than 7 days or tried 20 times are dropped.
- **Off switch:** nothing happens unless `GUARDRAIL_ENABLED=true` + `GUARDRAIL_URL` + a 32+ character
  `GUARDRAIL_SECRET` are all set.
- **Where events come from:**
  - Django's own `user_login_failed` / `user_logged_in` signals: the API sign-in AND the Django admin, with no view
    changed (Django blanks the password before sending the signal).
  - A middleware that only *reads* responses: scanner paths, any 429, a 403 for a signed-in user or a wrong jobs
    secret.
  - One line each in the Razorpay webhook (bad signature, `payment.failed`, amount mismatch), the checkout verify
    (bad signature) and refunds (`transaction.on_commit`, so a rolled-back refund is never reported).
- **Proven:** 30 HomeHaat tests (signature matches GuardRail's reference value; GuardRail down / 5xx / 429 → outbox;
  4xx → dropped; outbox cap; switched off → nothing sent; sign-in answers unchanged). And by hand: with GuardRail
  stopped, HomeHaat still answered in ~0.2 s, 11 events waited in the outbox, and the job delivered all 11 once
  GuardRail was back. That manual run also found two real issues, now fixed: the new table needs `migrate` (the
  start script and Render's build do it), and a backlog error after a good send had been logged as "events lost".

> *Say it:* "Monitoring is fire-and-forget: the request only queues a masked event, and a background thread signs and
> sends batches with a two-second timeout. If GuardRail is down the events wait in an outbox table and a scheduled
> job retries them, so the site never slows down and nothing is lost. There's an off switch, and tests prove sign-in
> works the same when GuardRail is down or off."

### 14. The attack simulator's safety guard — `lib/simulator/target.ts` [KEY LOGIC]

- `assertLocalTarget(url)` **parses** the address and allows only `localhost`, `127.0.0.1` or `[::1]` over http(s),
  with no user name. Matching text would be fooled: in `http://localhost@evil.com` the "localhost" is only a user
  name and the request goes to `evil.com`; `localhost.evil.com` and `127.0.0.1.nip.io` are real internet domains.
  Tests try each trick and all three live addresses.
- Fake attackers use `testNetIp(n)`: addresses from the ranges reserved for documentation (RFC 5737), never real
  people.
- The scenarios and what they should trigger in Stage 4:

| Scenario | What it does | Rule |
|---|---|---|
| brute-force | 12 wrong passwords on one account, from 3 IPs | T1110 |
| stuffing | one IP tries 8 different accounts | T1110.004 |
| scan | one IP asks for 8 scanner paths (`/.env`, `/wp-admin`…) | T1595 |
| flood | 62 sign-ins in seconds → 52 rate-limited | T1499 |
| forged-webhook | a fake Razorpay "payment captured" | T1565 |

> *Say it:* "The simulator only attacks localhost. It checks that by parsing the URL rather than matching text, so
> tricks like a user-name prefix or a look-alike domain are refused, and the tests try each one."

### 15. The detection rules — `lib/detection/rules.ts` [KEY LOGIC]

Each rule is a **pure function**: `evaluate(trigger, history)` gets the newest event and the earlier events with
the same key, oldest first, and returns a finding (severity, title, subject, event ids) or `null`. No database, no
clock, so each is unit-tested with small fixed lists (13 tests).

| Rule | MITRE | Key (grouped by) | Window | Fires when | Severity |
|---|---|---|---|---|---|
| Brute force | T1110 | account | 10 min | ≥ 10 `login_failed` | High |
| Credential stuffing | T1110.004 | IP | 10 min | failures on ≥ 5 different accounts | High |
| Forged payment webhook | T1565 | site | 1 h | any `webhook_signature_failed` | High |
| Scanning | T1595 | IP | 5 min | any `suspicious_path`; ≥ 5 | Low; Medium |
| Request flood | T1499 | IP | 1 min | ≥ 50 `rate_limited` | Medium |
| Sign-in from a new IP | T1078 | account | 30 days | a login from an IP not in that account's earlier logins (and it has some) | Medium; High for admin |

- **"Account"** = `actor_id` (the sender's keyed hash of the email), so two people with the same masked email are never
  mixed up; **"IP"** = the keyed IP hash, not the raw IP.
- Each rule also carries its MITRE link, a plain description and "What to do" advice for the incident page.

> *Say it:* "Each detection rule is a pure function over a window of events with the same key: account, IP or site.
> That makes them trivially testable with fixed event lists, and each one maps to a MITRE ATT&CK technique."

### 16. The engine, after the response — `lib/detection/engine.ts` [KEY LOGIC]

1. `POST /api/ingest` stores the events and answers 202 **first**. Detection runs in Next.js **`after()`**, so the
   sender's 2-second timeout never includes rules or email (on Vercel, `after` keeps the function alive to finish).
2. For each new event and each rule that watches its type: work out the key and keep only the **newest event per
   rule + key** (a batch of 50 failures for one account is one check, not 50).
3. Load that key's history in the rule's window with one indexed query, starting at the later of "window start" and
   "when I last resolved this attack".
4. A finding becomes an alert (section 17), then maybe an email (section 18). Each check is isolated in try/catch.

> *Say it:* "Detection runs after the response with Next's after(), so ingest stays fast. For each rule and key it
> evaluates once with the newest event, using a single indexed query for the window."

### 17. One alert per attack — `upsertAlert` in `lib/alerts/store.ts` [KEY LOGIC]

**Problem:** a brute force sends events for minutes; I want **one** alert that grows, not one per batch. And two
ingest requests may detect the same attack at the same moment.

- Every finding has a **group key** = rule + key (`brute_force:actor:ab12…`).
- Postgres has a **partial unique index**: `UNIQUE (group_key) WHERE status <> 'resolved'`. So there can be at most one
  not-resolved alert per group, enforced by the database itself.
- `INSERT … ON CONFLICT (group_key) WHERE status <> 'resolved' DO NOTHING RETURNING`: the first request creates the
  alert; a racing second one gets nothing back, then `SELECT … FOR UPDATE` locks the winner's row and updates it.
- Evidence: `alert_event` has primary key (alert, event), so linking is idempotent; `event_count` grows by the number
  of *new* links. Severity only goes **up** (low → medium → high), with a timeline entry.
- After "resolved", a new attack on the same key starts a **new** alert (the index ignores resolved ones).
  Reopening an old one is refused if a newer one is open (409), so the rule "one active alert" always holds.
- Status moves are a small table (`lib/alerts/status.ts`): open → acknowledged → resolved, resolved → open, checked
  on the server again (the buttons are only a convenience).

> *Say it:* "Alerts are deduplicated by a group key with a partial unique index, so only one active alert per attack
> can exist even under concurrency. The insert uses ON CONFLICT DO NOTHING and the loser locks and updates the
> winner's row in the same transaction."

### 18. Exactly-once events and email — `uid` and `lib/alerts/notify.ts` [KEY LOGIC]

**Exactly once (found by testing):** HomeHaat retries when GuardRail answers too slowly. If GuardRail had already
saved the batch, the retry would duplicate it. Fix: HomeHaat gives each event a random **`uid`** when it's created and
keeps it through every retry; GuardRail has `UNIQUE (source, uid)` and inserts with `ON CONFLICT DO NOTHING`, then
answers `{accepted, duplicates}`. At-least-once sending + de-duplication = each event stored exactly once. (Two
different senders' events with NULL uids never clash: Postgres treats NULLs as distinct.)

**Email (high alerts only):**
- `emailDecision` (pure, tested): only `high`; only once per alert (`emailed_at`); at most 20 a day (protects the
  inbox and Resend's free 100/day); and "not configured" is an honest outcome, not an error.
- **Claim before sending:** `UPDATE alert SET emailed_at = now() WHERE id = … AND emailed_at IS NULL RETURNING`. Only
  one process can win, so two detections at once can't send two emails. If the send fails, the claim is given back.
- **Privacy:** the email names the rule, MITRE id, site and event count, and links to the dashboard (sign-in + 2FA).
  It never contains an IP or the alert's subject: email isn't a private place. A test checks the IP is absent.
- Resend's HTTP API is called with `fetch` and a 5-second timeout (no SDK). Every outcome goes on the timeline.

> *Say it:* "Events carry an idempotency key, so retries are safe: at-least-once delivery plus a unique constraint
> gives exactly-once storage. High alerts send one email, claimed with a conditional update so concurrent detections
> can't double-send, capped per day, and the email never contains IPs."

### 19. A second site, and what its attacks taught me — Oppora `backend/guardrail/` [KEY LOGIC]

**Same design, different site.** Oppora got the same sender as HomeHaat (queue → background thread → signed batch
→ 2 s timeout → outbox), its own secret (`INGEST_SECRET_OPPORA`), and hooks that fit how Oppora works:
- Google sign-in has no password, so "failed login" means a **failed Google callback**: a forged or replayed
  `state`, an invalid ID token, an unverified email. Pressing **Cancel** or taking too long is normal user behaviour
  and is not reported (`HARMLESS_ERRORS`).
- The **shared public demo** is never reported: every recruiter signs in to the same account from a different IP,
  which would only raise false "sign-in from a new IP" alerts.
- The visitor IP is taken **exactly as Oppora's own rate limiter sees it** (DRF `get_ident`), so both agree.
- Its tests switch GuardRail off unless a test turns it on, so a developer's real `.env` can never make the test
  suite send events.

**A real weakness found by the simulator.** Oppora's flood test kept failing to raise an alert. Measuring it showed
why: sending 75 sign-in requests **8 at a time**, **70** got through a limit of 20 a minute (one at a time: exactly
20). Oppora uses DRF's `SimpleRateThrottle`, which reads the request history from Redis and writes it back in two
separate steps; requests arriving together all read the same old history. That's a classic **race condition
(check-then-act)**. The fix is an atomic counter (Redis `INCR` with an expiry, one step). It's recorded in Oppora's
CLAUDE.md and **fixed in its own session** (Oppora commit b0cc62c, local): an atomic counter, so 75 parallel
requests now give exactly 20 allowed / 55 blocked; 270 Oppora tests pass. The simulator's Oppora flood still sends
one at a time (it demonstrates detection, not the limiter).

> *Say it:* "Connecting the second site reused the same sender, adapted to Google sign-in: only tampered callbacks
> count as failures, and the shared demo account is excluded to avoid false alerts. Testing it with my attack
> simulator exposed a race condition in Oppora's rate limiter: parallel requests passed a 20-per-minute limit 70
> times, because the throttle reads and writes its counter in two steps. The fix is an atomic Redis counter."

### 20. Charts without a chart library — `components/charts/`, `lib/dashboard/buckets.ts`

- **Events over time:** one SQL query groups by `date_trunc('hour', received_at AT TIME ZONE 'Asia/Kolkata')` and
  site; `hourlyBuckets` (pure, tested) turns the rows into exactly 24 bars, filling empty hours with zero (a missing
  hour would make the chart lie). `niceMax` rounds the axis top to 4, 8, 20, 40… so gridlines land on round numbers.
- **Accessible by design:** colour + legend + tooltip + a "Show as a table" view; the chart is focusable and ← →
  move between hours. Busiest IPs is a ranked list with the number always written next to the bar.
- **Colours checked, not guessed:** the two series colours were run through a palette validator (colour-blind
  separation, contrast on the dark panel) before use.

> *Say it:* "I drew the charts in SVG myself rather than adding a library. The hourly data comes from one grouped
> query, zero-filled by a pure tested function, in India time. They're keyboard-accessible with a table fallback, and
> the colours were validated for colour-blind readers."

### 21. Log upload — `lib/logs/parse.ts` + `lib/logs/analyze.ts` [KEY LOGIC]

**What it does:** you upload an nginx/Apache access log or a Linux `auth.log`, and the SAME six rules run on it.
1. `parseLine` reads one line with a regular expression per format. Access logs: IP, time (with its time zone),
   request, status. 429 → `rate_limited`; a scanner path (`/.env`, `/wp-admin`… the same list HomeHaat uses) →
   `suspicious_path`; a refused POST to a sign-in path → `login_failed`; anything else is an ordinary line.
   auth.log: `Invalid user` / `Failed password` → `login_failed` with the account name, `Accepted` → `login_success`.
   Query strings are cut (tokens), emails masked, IPs validated. Unknown lines are counted, never guessed.
2. `analyzeEvents` sorts by time and, for each event and each rule that watches it, keeps a **sliding window** per
   rule + key (account / IP), drops events older than the rule's window (and keeps at most 500), and calls the rule's
   own `evaluate`. Findings with the same rule + key merge into **one finding per attack**, like alerts do.
3. The route checks the session + Origin, the size (header and real body), refuses `.gz` (magic bytes 1F 8B) and
   binary files, and returns the result. **Nothing is stored.**
- Line numbers are the event ids, so each finding tells you where to look in the file. Two sample logs (documentation
  IPs only) let anyone try it.

> *Say it:* "Log upload parses nginx, Apache and sshd logs into the same event types the sites send, then replays them
> through the same pure detection rules with a sliding window per key. It's all in memory: the file is never stored."

### 22. Retention: IPs for 30 days — `lib/retention.ts` + `app/api/cron/retention/route.ts` [KEY LOGIC]

- Daily at 03:00 IST Vercel Cron calls `/api/cron/retention`. Vercel adds `Authorization: Bearer <CRON_SECRET>`
  itself; `bearerMatches` compares SHA-256 digests with `timingSafeEqual` (equal length, constant time). No secret
  set = refuse everything.
- `UPDATE event SET ip = NULL WHERE received_at < now − 30 days`: the **keyed hash stays**, so "busiest IPs" and the
  per-IP rules still count correctly; only the readable address is gone. Alert titles about an IP lose it too.
- Also deletes expired sessions, sign-in tries older than a day and old nonces. Each step is one indexed statement.

> *Say it:* "Raw IPs are personal data, so a daily cron job nulls them after 30 days while keeping a keyed hash, which
> keeps the statistics and detection working. The endpoint is protected by a bearer secret compared in constant time."

### 23. A safe public demo — `lib/demo/world.ts` + `app/demo/` [KEY LOGIC]

- **No database at all:** the demo pages import only the generator, so real data can't leak and nothing can be
  written. The banner "Demo data." is in the layout, so no demo page can appear without it.
- **Same UI:** the Overview and incident layouts became shared views with a `base` ("/dashboard" or "/demo"); the
  parts that change things (status buttons, note form) are passed in, and the demo passes a read-only note.
- **Realistic, not hand-written:** a seeded random generator makes a day of normal traffic plus six attacks, counted
  back from "now"; the alerts come from running the REAL rules over those events (`analyzeEvents`). Older alerts are
  resolved with notes, newer ones open. A fake live feed (`DemoLiveProvider`) plugs into the same context as the real
  SSE feed, so live lists work unchanged.
- **Tested:** deterministic, every rule fires, only documentation IPs and masked emails, Overview numbers add up;
  and a browser test clicks through the demo while recording requests: zero POSTs.

> *Say it:* "The demo reuses the real components but never touches the database: a seeded generator builds a day of
> events and the real detection rules turn them into alerts. A test proves the demo makes no write requests."

### 24. The 3D globe, privately and cheaply — `components/landing/`, `lib/public/feed.ts` [KEY LOGIC]

- **Privacy first:** the public endpoint returns only `{code, lat, lon, attacks}` per country, for attack-type
  events in the last 24 h, hiding countries with fewer than 3 (so one visitor's typo can't be read as "someone in X").
  No IPs, accounts, paths or times; a test checks the response for anything that looks like an IP.
- **Honest:** with no real data the panel says "Simulated attacks" and the attacks are made up.
- **What you see:** attacks fly (Bézier arcs, lifted more for longer distances) from their country to the servers in
  Singapore, a ring flashes there ("blocked"), and high alerts hop on in red to the owner in India. Glass panels count
  what was blocked.
- **Performance:** Three.js is downloaded only if it will be used (`next/dynamic`, no server rendering); one Three.js
  layer animates every arc in `useFrame` without React re-renders and disposes finished objects; the scene stops when
  off screen or in a hidden tab; fewer attacks and a capped pixel ratio on phones.
- **Accessibility:** reduced motion or no WebGL → a still SVG globe; the globe has a text label; the flip cards are
  real buttons with `aria-pressed`, so Enter/Space/tap turn them.

> *Say it:* "The landing page globe is React Three Fiber, lazy-loaded and paused off screen, with a static SVG for
> reduced motion. It's fed by a public endpoint that only exposes per-country totals with a minimum count, so it
> shows real attack origins without revealing anything about individuals."

---

## Interview notes

### Stage 1
1. **How does your 2FA work, and how do you stop a code being reused?** It's TOTP (RFC 6238): HMAC-SHA1 of the
   30-second time step with a shared secret, truncated to 6 digits. I accept ±1 step for clock drift, compare in
   constant time, and save the last used step with a conditional update, so the same code, or an older one, is
   refused even inside its 30 seconds. Tests use the RFC's own test vectors.
2. **Why store a hash of the session token instead of the token?** If the database leaks, hashes can't be used as
   cookies. The token is 256 random bits, so SHA-256 is enough (no salt or slow hash needed, unlike passwords). The
   token is also replaced after the 2FA step, which prevents session fixation.
3. **Your login rate limit could lock you out: how do you handle that?** Limits are per IP (5) and per account (10)
   in a 15-minute sliding window. Blocked tries aren't counted, so the lock ends 15 minutes after the attacker stops,
   and the password step alone can't get in anyway because 2FA is required.

### Stage 2
1. **How do you know an event really came from HomeHaat and isn't forged or replayed?** Each site signs the
   timestamp, a random nonce and the raw body with HMAC-SHA256 using its own secret. I verify in constant time on
   the raw bytes, refuse anything more than 5 minutes off, and insert the nonce under a unique key so each request
   works once. Every failure returns the same 401.
2. **How do you do real-time updates on serverless hosting with no shared memory?** Server-Sent Events. Each stream
   polls Postgres every 2 s for rows with an id above its cursor and closes after ~50 s; the browser reconnects
   automatically with Last-Event-ID, so nothing is missed. One connection per tab, polling as a fallback, paused
   while the tab is hidden.
3. **What privacy measures apply to the events you collect?** Emails are masked, paths lose their query strings
   (they can contain reset tokens), `meta` only keeps allow-listed keys, IPs are also stored as a keyed hash so the
   raw IP can be deleted after 30 days, and all of it runs on the server even if a sender forgets.

### Stage 3
1. **How do you make sure monitoring can never slow down or break the site it watches?** The request only puts a
   masked event in an in-memory queue and returns; a background thread sends batches with a 2-second timeout, and
   every error is caught. If GuardRail is down, events wait in an outbox table and a scheduled job retries them.
   Tests, and a real outage I staged, show sign-in answers the same with GuardRail down or switched off.
2. **How did you capture logins without changing every view?** With Django's `user_login_failed` and
   `user_logged_in` signals, which fire for the API sign-in and the admin login alike; Django removes the password
   from the credentials before sending the signal. Scanner paths, rate limits and 403s come from a middleware that
   only reads the response.
3. **How do you test attacks safely?** A simulator that only targets localhost (checked by parsing the URL, so
   `localhost@evil.com` is refused), uses documentation-only IP ranges, and goes through HomeHaat's real CSRF checks
   and rate limits, so GuardRail sees exactly what a real attack would produce.

### Stage 4
1. **How do you avoid hundreds of alerts for one attack, even with concurrent requests?** Each finding gets a group
   key (rule + account/IP/site), and a partial unique index allows only one not-resolved alert per key. The insert
   uses ON CONFLICT DO NOTHING; whoever loses the race locks the existing row with SELECT FOR UPDATE and adds the new
   evidence. Repeats grow one alert, and severity only goes up.
2. **Your detection runs on serverless: how do you keep ingest fast?** The route stores the events and returns 202,
   then runs the rules in Next.js after(), which keeps the function alive after the response. Each rule is a pure
   function evaluated once per rule and key with one indexed history query.
3. **What happens if the sender retries a batch you already saved?** Every event carries a uid made once by the sender
   and kept through retries; a unique (source, uid) constraint with ON CONFLICT DO NOTHING stores it exactly once.
   I found this case by testing: a slow first response made HomeHaat retry events GuardRail had already stored.

### Stage 5
1. **How did you add a second site without breaking or slowing it?** The same fire-and-forget sender (queue,
   background thread, 2-second timeout, outbox with retries, off switch), its own signing secret, and hooks chosen
   for how that site works. Its whole test suite still passes, and tests prove sign-in is unchanged when GuardRail is
   down.
2. **Why don't you report the demo account's sign-ins?** It's one shared account used by many visitors from many
   IPs, so the "sign-in from a new IP" rule would fire constantly. Excluding it at the source keeps alerts meaningful.
   It's a deliberate trade-off, written down.
3. **Tell me about a bug your tools found.** My attack simulator showed Oppora's sign-in limit of 20 a minute let 70
   of 75 parallel requests through. DRF's throttle reads and then writes its counter, so simultaneous requests all
   see the old count: a check-then-act race. The fix is an atomic increment in Redis. I documented it as its own task
   instead of quietly changing a live site's limits.

### Stage 6
1. **How do you show attack data publicly without leaking anything?** The public endpoint only returns per-country
   totals of attack events over 24 hours, hides countries with fewer than three events so no individual stands out,
   and never includes IPs, accounts, paths or timestamps. It's cached for a minute, and when there's no real data
   the page says the attacks are simulated.
2. **How does the log upload reuse your detection?** Parsers turn access-log and sshd lines into the same event types
   the sites send, then the events are replayed in time order through the same pure rule functions with a sliding
   window per account or IP. Findings merge into one per attack. It runs in memory and stores nothing.
3. **How do you keep a public demo safe?** The demo pages never import the database; they render the same view
   components with data from a seeded generator, and the alerts come from running the real rules on that data. The
   controls that change things are replaced, a banner is in the layout, and a browser test checks the demo sends no
   write requests.

---

## Stage log

- **Stage 1 (20 Oct 2026):** Next.js 16.4 + TypeScript strict + Tailwind v4 tokens and fonts; Docker Postgres on
  5434 with `guardrail` + `guardrail_e2e`; Drizzle schema + first migration; start script + .bat; `admin:create`,
  `admin:reset-2fa`, `throwaway-check`; sign-in (Argon2id → TOTP), forced 2FA setup with QR, login rate limit,
  sessions, nonce CSP + security headers, CSRF Origin check; dashboard shell (sidebar / phone `<dialog>` menu, skip
  link, Overview with real failed-sign-in count, empty states, skeleton, error page); 47 unit tests (Vitest),
  7 Playwright tests (2FA setup, sign-in, code replay refused, phone menu by keyboard, CSP nonce, CSRF, lockout).
- **Stage 2 (20 Oct 2026):** `event` + `ingest_nonce` tables (migration 0001); `POST /api/ingest` with HMAC-SHA256
  over `v1:timestamp:nonce:body`, ±5 min window, nonce replay protection, 64 KB limit, per-source rate limit,
  per-event Zod validation with masking / path cleaning / meta allow-list; `GET /api/stream` (SSE, 50 s streams,
  Last-Event-ID) + `GET /api/events` (pages / polling fallback); `LiveProvider` (one connection, polling fallback,
  pause when hidden); Events page (filters in the URL, search IP/account/path, pagination, live rows); Overview and
  Sources with real numbers; `send-test-event` script (localhost only). 78 unit tests, 19 Playwright tests (ingest
  attacks: forged, other site's secret, stale, replayed, unknown source, oversized; live updates; filters; pages;
  pause when hidden).
- **Stage 3 (21 Oct 2026):** in HomeHaat, a `backend/guardrail/` app (signed background sender, 2 s timeout,
  OutboxEvent + retry job, off switch; login signals; read-only middleware; hooks in webhook / verify / refunds;
  visitor country via the proxy) with 30 new tests (HomeHaat 353 backend tests and 45 frontend tests all pass).
  In GuardRail, `simulate` (5 scenarios, localhost only) and `connect:homehaat`; 83 unit tests. One simulation
  delivered all 91 events; in a staged outage HomeHaat was unaffected and the 11 waiting events arrived afterwards.
- **Fix (21 Oct 2026):** event paths wrap only after "/" (no more `/api/auth/signi` + `n/`); long segments shortened,
  full path on click/tap/Enter.
- **Stage 4 (21 Oct 2026):** migrations 0002 (alert, alert_event, alert_activity, event.actor_id) and 0003
  (event.uid + unique per source); six rules + engine in `after()`; one-alert-per-attack upsert with a partial unique
  index; status flow, notes, merged incident timeline; optional Resend email (high only, once, 20/day, no IPs);
  Alerts list + incident page, Overview card/panel, sidebar badge, live refresh. HomeHaat (local commit only) sends
  `actor_id` and `uid`. 111 unit tests, 25 Playwright tests. By hand: one simulation raised all five attack types
  (brute force, stuffing, forged webhook = high; flood, scan = medium); acknowledge → note → resolve worked.
- **Stage 5 (21 Oct 2026):** Oppora `backend/guardrail/` (local commit 94ee087, not pushed): sender, login signal
  (demo excluded), failed Google callbacks, sign-in rate limits, middleware (scanner paths, 429, wrong cron secret,
  403), Celery Beat + scheduler resends; 14 new tests, Oppora 267 passing. GuardRail: `simulate --site oppora`
  (scan, flood, forged-callback, cron-guess), one `connect` script for both sites. By hand on a local Oppora: scan
  and flood raised medium alerts; forged callbacks (`state_mismatch`) and scheduler-secret guesses arrived as events.
  Found: Oppora's DRF throttles can be passed by parallel requests (70 of 75 through a 20/min limit). Fixed the same
  day in a separate session (Oppora b0cc62c, local): atomic counter, now 20 allowed / 55 blocked; 270 tests pass.
- **Stage 6 (21 Oct 2026):** Overview charts (hand-drawn SVG: events per IST hour stacked by site, with keyboard
  tooltip and table view; busiest IPs); log upload (nginx/Apache + auth.log parsers, same rules in memory, nothing
  stored, sample logs); daily retention (IPs wiped after 30 days, hash kept; Vercel Cron + `CRON_SECRET`); public
  read-only demo (shared views, seeded data, real rules, fake live feed, "Demo data." banner); 3D landing page (React
  Three Fiber globe, lazy, still SVG for reduced motion, public country-only feed, flip cards). Shell/nav take a
  `base`. Found by tests: the chart fetched events from a partial hour it never drew; the full e2e run needed every
  page and API route warmed up (dev-mode compiling took over 5 s once the app grew). 146 unit tests, 35 Playwright
  tests (passed twice in a row).
