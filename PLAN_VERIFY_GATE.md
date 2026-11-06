# Plan: Full-Page Verification Gate (Turnstile)

Move Turnstile OFF the sign-in/sign-up forms and onto a dedicated **whole-page
verification screen** (like Cloudflare's own "checking your browser…"
interstitial), shown:

1. **Once per day per visitor** — guests included. First visit of the day →
   full-page check → free to browse for 24h on that device.
2. **On every sign-in** — each login attempt requires passing the page again,
   even if the daily check is still valid. Sign in twice → verify twice.
   (Sign-up counts the same as a sign-in.)

---

## 1. How it works — the "verification pass"

Stateless, no session infrastructure needed. After the user solves the
challenge, the server verifies it with Cloudflare and hands back a **signed
pass** (HMAC-SHA256 with the existing `JWT_SECRET`, same machinery as the auth
JWT). Two kinds of pass:

| Pass | Lifetime | Purpose | Reusable? |
|---|---|---|---|
| `daily` | 24 h | Browsing gate (client-side) | yes, until expiry |
| `auth` | 10 min | One sign-in / sign-up attempt | **no — single-use** |

- The `daily` pass sits in localStorage; the app shell checks it on startup
  and on navigation. Missing/expired → redirect to `#/verify`, solve, continue
  where you left off.
- The `auth` pass carries a random nonce. The login/register endpoint verifies
  the signature AND burns the nonce in a tiny D1 table — replaying the same
  pass (second sign-in) is rejected, which forces a fresh full-page check per
  attempt. Exactly the "2 sign-ins → 2 challenges" behaviour.

Single-use enforcement needs one small table (that's the only DB change):

```sql
-- ============================================================
-- verify_nonces (single-use auth verification passes)
-- ============================================================
CREATE TABLE IF NOT EXISTS verify_nonces (
  nonce TEXT PRIMARY KEY,
  used_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```
Rows self-prune (anything older than ~15 min is garbage; pruned
opportunistically on insert).

## 2. Backend changes

- **New `POST /api/verify`** — body `{turnstile_token, purpose: "daily"|"auth"}`.
  Verifies with Cloudflare siteverify (existing `_lib/turnstile.ts`), returns
  `{pass, expires_at}`. If `TURNSTILE_SECRET` isn't configured, it issues the
  pass without a challenge (keeps local dev + pre-setup deploys working).
- **`/api/auth/login` + `/api/auth/register`** — replace the inline
  `turnstile_token` check with: require a valid, unexpired, **unused** `auth`
  pass; burn its nonce on success *or failure* of the credential check (a
  wrong password also consumes the pass — retry means re-verify. Simpler and
  stricter; can relax later if it annoys users).
- **`/api/auth/forgot`** — same treatment (it currently has inline Turnstile).

## 3. Frontend changes

- **New `#/verify` page** — full-screen, branded (logo + "Quick security
  check"), Turnstile widget centered, auto-submits when solved, then redirects
  to `?then=<route>` (default `/`). Handles the widget failing to load
  (offline → skip with a note; the gate never locks the cached PWA out).
- **App shell gate** — on startup and on hash navigation: no valid `daily`
  pass → `#/verify?then=<current>`. The verify page itself, and offline mode,
  are exempt.
- **Sign-in / Sign-up / Forgot pages** — Turnstile widget REMOVED. Instead:
  arriving without a fresh `auth` pass redirects to
  `#/verify?purpose=auth&then=/signin` first; coming back with the pass, the
  form submits normally and the pass rides along in the request body.
- Remove the `TurnstileWidget` usage from the three forms (component stays,
  reused by the verify page).

## 4. Flow summary

```
Guest, first visit today:   site → #/verify (daily) → browse 24h
Guest, later same day:      site → straight in
Sign-in #1:                 #/signin → #/verify (auth) → back → login OK
Sign-in #2 (same day):      #/signin → #/verify AGAIN (nonce burned) → login
Sign-up:                    same as sign-in
```

## 5. Notes / trade-offs

- The daily gate is a **client-side** gate (it protects UX and signups, and
  Turnstile still hard-protects all auth endpoints server-side). Someone
  calling the JSON API directly bypasses the daily page — but they could
  anyway; the valuable protection (auth, feedback, chat) stays server-enforced.
- PWA/offline: cached app opens without the gate when there's no network
  (verification is impossible offline; blocking would brick the PWA).
- Your Turnstile widget key settings stay the same — same site key, same
  `TURNSTILE_SECRET`.

## 6. Build order

1. DDL: `verify_nonces` (appended to `d1_ddl.sql`, you run the usual command).
2. `POST /api/verify` + pass signing/validation in `_lib`.
3. Switch login/register/forgot to require+burn `auth` passes.
4. `#/verify` page + router + app-shell daily gate.
5. Strip Turnstile from the three forms, wire the redirect dance.
6. Typecheck/build + local wrangler test (daily pass, auth pass, replay
   rejected, second sign-in forces re-verify).

Say go and I'll build it.
