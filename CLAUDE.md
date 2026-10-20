# GuardRail: project notes

A mini SIEM: a security monitoring dashboard for Rasmitha's two live sites, **HomeHaat** and **Oppora**. They send
HMAC-signed security events; GuardRail runs MITRE ATT&CK-mapped detection rules, raises alerts and shows everything
live. Full brief and stage plan: `PROMPT.md`. Next.js 16 notes for agents: `AGENTS.md` (read the bundled docs in
`node_modules/next/dist/docs/` before using a Next.js API; this version differs from older ones).

**Current stage: 1 of 7 done — setup, local DB, sign-in with 2FA, dashboard shell, GitHub repo.
Next: Stage 2 (signed ingest API + live events list). Waiting for Rasmitha to say "continue".**

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
    api/health/             liveness, no database
    not-found.tsx, icon.svg
  components/
    Logo.tsx                shield mark + wordmark
    ui/                     Button (+ buttonClass for Links), Panel, StatCard, EmptyState, SeverityBadge, LiveDot,
                            Mono, FormError
    shell/                  AppShell (+ PageHeader), NavLinks, MobileNav (<dialog>), SignOutButton, nav.ts
    auth/                   AuthCard, SignInForm, SetupTwoFactor, CodeField
    settings/               SignOutEverywhere
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
    dashboard/overview.ts   Overview numbers (failed sign-ins 24 h, signed-in devices)
    safety.ts               assertThrowaway()
  scripts/                  migrate, admin-create, admin-reset-2fa, throwaway-check, prompt (hidden input)
  e2e/                      Playwright: fixtures.ts (test values), global-setup.ts (resets guardrail_e2e), auth.spec.ts
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
| `/dashboard` | Overview: 4 StatCards (events/alerts "—" until Stage 2/4, sources 0/2, real failed sign-ins), Live events (empty), Sources, Your account |
| `/dashboard/events`, `/alerts`, `/sources`, `/upload` | empty states saying what comes (Stages 2–6) |
| `/dashboard/settings` | account, 2FA status, password/2FA commands, Sign out everywhere (with confirm) |

## API (all JSON; errors are `{ error: { code, message, retryAfterSec? } }`)

| Route | What |
|---|---|
| `POST /api/auth/signin` | `{email, password}` → `{next: "code" \| "setup-2fa"}` + short "password only" session cookie. 401 `wrong_credentials`, 429 `rate_limited` |
| `POST /api/auth/2fa/verify` | `{code}` → `{next: "dashboard"}` + new full session. 401 `wrong_code` / `no_pending_signin`, 429 |
| `POST /api/auth/2fa/setup` | → `{qrDataUrl, secret, account}` (only while 2FA is off) |
| `POST /api/auth/2fa/setup/confirm` | `{code}` → turns 2FA on + full session |
| `POST /api/auth/signout`, `/signout-all` | end this / every session |
| `GET /api/health` | `{ok: true}`, no database |

Every POST checks `Origin` (403 `bad_origin` otherwise).

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

---

## Stage log

- **Stage 1 (20 Oct 2026):** Next.js 16.4 + TypeScript strict + Tailwind v4 tokens and fonts; Docker Postgres on
  5434 with `guardrail` + `guardrail_e2e`; Drizzle schema + first migration; start script + .bat; `admin:create`,
  `admin:reset-2fa`, `throwaway-check`; sign-in (Argon2id → TOTP), forced 2FA setup with QR, login rate limit,
  sessions, nonce CSP + security headers, CSRF Origin check; dashboard shell (sidebar / phone `<dialog>` menu, skip
  link, Overview with real failed-sign-in count, empty states, skeleton, error page); 47 unit tests (Vitest),
  7 Playwright tests (2FA setup, sign-in, code replay refused, phone menu by keyboard, CSP nonce, CSRF, lockout).
