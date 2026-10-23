# Putting GuardRail online (free)

This guide puts GuardRail on the internet using only free plans, then connects HomeHaat and Oppora to it. You don't
write any code. Allow about an hour.

| Part | Service (free plan) | What it does |
|---|---|---|
| Database | **Neon**, its own project `guardrail` (Singapore) | events, alerts, the one account, sessions |
| Website + API | **Vercel**, Hobby, functions in Singapore (`sin1`) | the dashboard, `/api/ingest`, the public home page and demo |
| Daily clean-up | **Vercel Cron** (in `vercel.json`) | 03:00 IST: wipes IPs older than 30 days, old sessions and nonces |
| Alert emails | **Resend** (already set up) | one email per high alert, to your own address |
| The two sites | **Render** (HomeHaat, Oppora), already online | send signed events to GuardRail |

> **Money rule:** every step below is free. If any website asks for a card or a paid plan, **stop and tell
> Claude** before clicking anything.

> **Secrets rule:** every secret lives in one private file, **`C:\Users\rasmi\guardrail-secrets.env`**, outside all
> repositories. You copy values from it into dashboards. Never into chat, GitHub or a document. Claude's scripts read
> it without printing the values.

Dashboards change their buttons now and then. If a label is a little different, look for the closest match.

---

## Step 0. The private settings file (done for you)

Claude's script made `C:\Users\rasmi\guardrail-secrets.env` with fresh, random production values:
`ENCRYPTION_KEY`, `HASH_SECRET`, `INGEST_SECRET_HOMEHAAT`, `INGEST_SECRET_OPPORA`, `CRON_SECRET`, and copied
`RESEND_API_KEY` / `ALERT_EMAIL_TO` from your laptop's `.env`. Two lines are still to fill: `DATABASE_URL` (step 1)
and `APP_URL` (step 3).

Open it with Notepad: Start → type **Notepad** → **File → Open** → `C:\Users\rasmi` → change "Text documents" to
**All files** → `guardrail-secrets.env`.

Keep a copy in your password manager when you're done. If this file is lost, nothing breaks (the values are in
Vercel and Render), but you'd have to look them up there.

---

## Step 1. Neon (the database)

Neon's free plan allows 100 projects, each with its own 1 GB and its own compute hours, so GuardRail gets its own
project and never uses HomeHaat's or Oppora's allowance.

1. Open <https://console.neon.tech> (you're already signed up).
2. **New Project**:
   - **Project name:** `guardrail`
   - **Postgres version:** the newest one offered (17 or later)
   - **Region:** **AWS Asia Pacific (Singapore)** (the same city as Vercel's functions and the two sites' servers)
3. When it's ready, click **Connect** (top right).
4. Leave **Connection pooling ON** (GuardRail runs on Vercel, where many short-lived functions connect; the pooler
   shares connections between them). **Copy the connection string.** It looks like
   `postgresql://neondb_owner:••••@ep-something-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`
   (note `-pooler` in the address).
5. In Notepad, paste it right after `DATABASE_URL=` in **`guardrail-secrets.env`** (no quotes, no spaces) and
   **save** the file.
   > **Not into `guardrail\.env`.** That file is your laptop's copy and already has a `DATABASE_URL` (the local
   > Docker database). A second one at the end would win, and your laptop's GuardRail would quietly use the live
   > database. (This happened once; Claude moved the line across without showing it.)
6. Change `sslmode=require` at the end of the string to **`sslmode=verify-full`**. Both check Neon's certificate
   today, but the database driver warns that `require` will mean less in its next version; `verify-full` keeps the
   full check.
7. Tell Claude "Neon done". Claude runs `npm run live:migrate`, which creates GuardRail's tables in the new database
   (it only creates; it never deletes) and prints `Database is up to date.`

---

## Step 2. (Claude) Tables in the live database

```powershell
npm run live:migrate
```

Reads the settings file, connects to Neon over TLS and applies the migrations in `drizzle/`. Safe to run again.

---

## Step 3. Vercel (the website and API)

1. Open <https://vercel.com> (you're already signed in with GitHub, on Hobby).
2. **Add New… → Project**. Find **guardrail** and click **Import** (if it isn't listed: **Adjust GitHub App
   Permissions** → allow **GollapalliRasmitha/guardrail**).
3. On "Configure Project":
   - **Project Name:** `guardrail` (Vercel may suggest another if taken; that's fine).
   - **Framework Preset:** Next.js (detected by itself). **Root Directory:** leave as it is (`./`).
   - Open **Environment Variables**. In Notepad, select every line from `DATABASE_URL=` down to the last line
     (`ALERT_EMAIL_TO=…`) and copy. Click into the first **Key** box in Vercel and **paste**: Vercel splits the
     lines into separate variables by itself. Check you see 9 rows: `DATABASE_URL`, `APP_URL`, `ENCRYPTION_KEY`,
     `HASH_SECRET`, `INGEST_SECRET_HOMEHAAT`, `INGEST_SECRET_OPPORA`, `CRON_SECRET`, `RESEND_API_KEY`,
     `ALERT_EMAIL_TO` (comment lines are ignored).
4. Click **Deploy**. After 2–3 minutes you get your address, for example `https://guardrail.vercel.app` or
   `https://guardrail-xxxx.vercel.app`.
5. **If the address isn't exactly `https://guardrail.vercel.app`:**
   - correct `APP_URL=` in the settings file (https, no slash at the end) and save;
   - Vercel → the project → **Settings → Environment Variables** → `APP_URL` → **Edit** → the same value → **Save**;
   - **Deployments** → the newest → **⋯** → **Redeploy**.
   Until `APP_URL` matches, signing in says "This request didn't come from GuardRail" (that's the CSRF check).

   GuardRail's address is **`https://guardrail-rasmitha.vercel.app`**. Vercel also gave it a second address
   (`guardrail-iota.vercel.app`); pages work there, but signing in only works on the address in `APP_URL`. To send
   everyone to the right one: **Settings → Domains** → `guardrail-iota.vercel.app` → **Edit** → **Redirect to**
   `guardrail-rasmitha.vercel.app` → **Save**.

Things already set by the code, nothing to click:
- **Region:** `vercel.json` says `"regions": ["sin1"]` (Singapore). Check: **Settings → Functions** shows Singapore.
- **Daily clean-up:** `vercel.json` has the cron. Check: **Settings → Cron Jobs** lists `/api/cron/retention`. Vercel
  sends `CRON_SECRET` with each call by itself.

Check it:
- `https://<your address>/api/health` shows `{"ok":true}`.
- `https://<your address>/` shows the home page with the globe ("Simulated attacks" until real events arrive).
- `https://<your address>/demo` works signed out, with the "Demo data." strip on top.

---

## Step 4. Your account, then sign in and set up 2FA

1. In a PowerShell window in the guardrail folder:

   ```powershell
   npm run live:admin-create
   ```

   Type your email and a password (14+ characters; a few random words work well). The password is hidden while you
   type. This creates the ONE account in the live database.
2. **Right away**, open `https://<your address>/signin`, sign in, scan the QR code with your authenticator app and
   type the 6-digit code. 2FA is now on, and from now on it can only be reset from the terminal.
3. You land on the dashboard. Sources show "Not connected" until steps 5 and 6.

---

## Step 5. Connect HomeHaat (Render: `homehaat-api`)

First, Claude pushes HomeHaat's GuardRail commits to GitHub (only those: never your video changes or untracked files).
Render then redeploys `homehaat-api` by itself.

1. Render → **homehaat-api** → **Environment** → **Add Environment Variable**, four times:

   | Key | Value |
   |---|---|
   | `GUARDRAIL_ENABLED` | `true` |
   | `GUARDRAIL_URL` | `https://guardrail-rasmitha.vercel.app` (no slash at the end) |
   | `GUARDRAIL_SECRET` | the value of **`INGEST_SECRET_HOMEHAAT`** from the settings file |
   | `TRUSTED_PROXY_HOPS` | `3` (requests that skip the website: see "Real visitor IPs" below) |

2. **Save, rebuild, and deploy** (or **Save changes**, then **Manual Deploy → Deploy latest commit**).
3. When it says **Live**, Claude sends one harmless request for `/.env` to the live API and checks it arrives in
   GuardRail as a "Suspicious path" event, then checks HomeHaat's home page, sign-in and a product page.

---

## Step 6. Connect Oppora (Render: `oppora-api`, and Oppora's Vercel project)

Same as step 5, with Oppora's values. Oppora has one Render service (`oppora-api`; no separate worker on the free
plan).

| Where | Key | Value |
|---|---|---|
| Render `oppora-api` | `GUARDRAIL_ENABLED` | `true` |
| Render `oppora-api` | `GUARDRAIL_URL` | `https://guardrail-rasmitha.vercel.app` |
| Render `oppora-api` | `GUARDRAIL_SECRET` | the value of **`INGEST_SECRET_OPPORA`** from the settings file |
| Render `oppora-api` | `NUM_PROXIES` | `3` |
| Render `oppora-api` **and** Vercel (Oppora's project) | `PROXY_SECRET` | the value of **`OPPORA_PROXY_SECRET`** from the settings file (then **Redeploy** on Vercel) |

Then Claude checks Oppora's home page, demo and Google sign-in start, and that a probe arrives in GuardRail.

### Real visitor IPs (found after going live, 23 Oct 2026)

On Render every request passes through **Cloudflare** and **Render's own relay** before Django; from the websites
it also passes through **Vercel**. Measured by sending fake documentation addresses in `X-Forwarded-For` and reading
which address each site stored:

- **Straight to Render** (scanners, scripts): the list ends "visitor, Cloudflare, Render's relay", so the visitor is
  **3rd from the end**, and anything a visitor writes at the front is ignored (Cloudflare writes the real address
  after it). HomeHaat: `TRUSTED_PROXY_HOPS=3`. Oppora: `NUM_PROXIES=3`.
- **Through the website**, Vercel adds one more step, so each website passes the visitor's IP itself, with a shared
  secret (`PROXY_SECRET` in both Vercel and Render); Django trusts that header only with the right secret.

Before this, every Oppora visitor looked like a Cloudflare address (`172.69.…`), so visitors behind the same Cloudflare
data centre shared one sign-in limit, and HomeHaat's direct requests all looked like Render's relay.

---

## Which value goes where

| Name | Vercel (guardrail) | Render homehaat-api | Render Oppora | Where it comes from |
|---|---|---|---|---|
| `DATABASE_URL` | ✓ | | | Neon → guardrail → Connect (pooled) |
| `APP_URL` | ✓ | ✓ as `GUARDRAIL_URL` | ✓ as `GUARDRAIL_URL` | your Vercel address |
| `ENCRYPTION_KEY`, `HASH_SECRET` | ✓ | | | settings file (made by Claude) |
| `INGEST_SECRET_HOMEHAAT` | ✓ | ✓ as `GUARDRAIL_SECRET` | | settings file |
| `INGEST_SECRET_OPPORA` | ✓ | | ✓ as `GUARDRAIL_SECRET` | settings file |
| `CRON_SECRET` | ✓ | | | settings file (Vercel Cron sends it) |
| `RESEND_API_KEY`, `ALERT_EMAIL_TO` | ✓ | | | Resend (copied from your laptop's `.env`) |
| `GUARDRAIL_ENABLED` = `true` | | ✓ | ✓ | the off switch |
| `OPPORA_PROXY_SECRET` | | | ✓ as `PROXY_SECRET` (and in Oppora's Vercel project) | settings file |
| `TRUSTED_PROXY_HOPS` = `3` / `NUM_PROXIES` = `3` | | ✓ (`TRUSTED_PROXY_HOPS`) | ✓ (`NUM_PROXIES`) | measured, see above |

All names are also in `.env.example` (without values).

---

## Updating later

Every push to `main` redeploys GuardRail on Vercel by itself. If a change adds a database migration, run
`npm run live:migrate` **before** pushing (migrations only add; the old version keeps working with the new tables).

To change your password: `npm run live:admin-create` with the same email. Lost your phone:
`npx tsx --env-file=../guardrail-secrets.env scripts/admin-reset-2fa.ts`, then sign in and set up 2FA again.

## Free plan limits (what to expect)

| Service | Free limit | GuardRail's use |
|---|---|---|
| Neon | 1 GB and 100 compute-hours a month per project; sleeps after 5 quiet minutes | tiny tables; the live feed pauses when the tab is hidden and the public globe is cached for 60 s, so it can sleep |
| Vercel Hobby | one function region; cron once a day (± 59 minutes); personal, non-commercial use | Singapore; one daily clean-up |
| Resend | 100 emails a day | at most 20 a day (GuardRail's own cap), high alerts only |

## If something goes wrong

| What you see | Likely cause | Fix |
|---|---|---|
| Signing in says "This request didn't come from GuardRail" | `APP_URL` isn't exactly your address | correct it in Vercel (https, no slash), **Redeploy** |
| Pages show "Something went wrong" right after deploying | a setting is missing or malformed | Vercel → **Logs**: the message names the setting (never its value) |
| Sources stay "Not connected" | `GUARDRAIL_*` missing on Render, or the secret differs | paste the same value in both; Render redeploys |
| GuardRail's Logs show `401` on `/api/ingest` | the site's `GUARDRAIL_SECRET` ≠ GuardRail's `INGEST_SECRET_…` | copy it again from the settings file |
| Timeline says "No email: …" | Resend not set up, or `ALERT_EMAIL_TO` isn't your Resend account's email | fix in Vercel, **Redeploy** |
| `/api/cron/retention` shows 401 in Logs | `CRON_SECRET` missing in Vercel | add it from the settings file, **Redeploy** |
