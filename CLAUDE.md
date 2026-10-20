# GuardRail: project notes

A mini SIEM: a security monitoring dashboard for Rasmitha's two live sites, **HomeHaat** and **Oppora**. They send
HMAC-signed security events; GuardRail runs MITRE ATT&CK-mapped detection rules, raises alerts and shows everything
live. Full brief and stage plan: `PROMPT.md`. Next.js 16 notes for agents: `AGENTS.md` (read the bundled docs in
`node_modules/next/dist/docs/` before using a Next.js API; this version differs from older ones).

**Current stage: 2 of 7 done — signed ingest API (HMAC + timestamp + nonce) and live events (SSE).
Next: Stage 3 (HomeHaat sends events, local first, + attack simulator). Waiting for Rasmitha to say "continue".**

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
```

**Ports:** Postgres **5434** (HomeHaat 5433, Oppora 5432), app **3100**, end-to-end copy **3101**. All three
projects can run at the same time.

## Folder structure

```
guardrail/
  app/                      Next.js App Router
    layout.tsx              fonts (Chakra Petch / IBM Plex Sans / IBM Plex Mono), reads headers() so every page
                            renders per request (needed for the CSP nonce)
    globals.css             design tokens (CSS variables -> Tailwind names), .grid-ground, .eyebrow, .input
    page.tsx                public home (Stage 6: 3D globe)
    signin/, setup-2fa/     sign-in (password -> code) and first-time 2FA setup
    dashboard/              layout.tsx (requireActiveSession + AppShell), page.tsx (Overview), events/, alerts/,
                            sources/, upload/, settings/, loading.tsx (skeleton), error.tsx (retry)
    api/auth/               signin, 2fa/verify, 2fa/setup (+ confirm), signout, signout-all
    api/ingest/             POST: signed events from HomeHaat/Oppora [KEY LOGIC order of checks]
    api/stream/             GET: Server-Sent Events live feed [KEY LOGIC]
    api/events/             GET: a page of events, or ?after= (the live feed's polling fallback)
    api/health/             liveness, no database
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
    ui/Pagination.tsx       Newer / Older links that keep the filters
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
  scripts/                  migrate, admin-create, admin-reset-2fa, throwaway-check, send-test-event, prompt
  e2e/                      Playwright, run in file order: 01-auth, 02-ingest, 03-live, 99-lockout (locks sign-in, so
                            last); fixtures.ts (test values), helpers.ts (signInAsAdmin, sendSigned), global-setup.ts
                            (resets guardrail_e2e, warms up pages)
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

Fonts: **Chakra Petch** (`font-display`: headings, big numbers), **IBM Plex Sans** (body), **IBM Plex Mono**
(`font-mono`: IPs, times, IDs, codes, MITRE IDs, `.eyebrow` labels). Loaded with `next/font/google` (self-hosted).

Rules: severity = colour + word + icon (`SeverityBadge`); 44px touch targets (`min-h-11`); one teal focus ring
everywhere (`:focus-visible`); skip link in AppShell; `prefers-reduced-motion` turns animation off; every page has
loading (`loading.tsx`), empty (`EmptyState`) and error (`error.tsx`) states.

## Pages

| URL | What |
|---|---|
| `/` | public home: hero, "What it catches" (4 MITRE cards). Stage 6: 3D globe + demo |
| `/signin` | step 1 email + password (show/hide), step 2 the 6-digit code; refresh keeps you on step 2 |
| `/setup-2fa` | first sign-in only: QR + typed key + confirm code |
| `/dashboard` | Overview: 4 StatCards (events 24 h, open alerts "—" until Stage 4, sources online n/2, failed sign-ins), Live events (latest 8, grows live), Sources (Online / Quiet / Not connected), Your account |
| `/dashboard/events` | filter bar (source, event type, search IP/account/path; a GET form → URL), live list (page 1 grows live; later pages show "N new events"), pagination 25/page |
| `/dashboard/sources` | per site: secret set or not (never the value), last event, events 24 h, how it sends |
| `/dashboard/alerts`, `/upload` | empty states saying what comes (Stages 4, 6) |
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
| `GET /api/health` | `{ok: true}`, no database |

Every browser POST checks `Origin` (403 `bad_origin` otherwise). `/api/ingest` has no cookies and is checked by
its signature instead.

**Event fields** (all optional except `type`, `occurred_at`): `ip` (v4/v6), `actor`, `path`, `method`,
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
  - `actor` masked: `priya.sharma@gmail.com` → `pr****@gmail.com`.
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
