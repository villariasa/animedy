# Animedy — Final Deployment Steps (User Accounts & Sync)

The accounts + sync + admin monitoring feature is fully implemented and tested.
These 4 manual steps finish the rollout. Run all `wrangler` commands from
`src/ui_test/` (that's where `wrangler.toml` lives).

---

## 1. Create the new table in remote D1

The `user_activity` table (admin presence/monitoring heartbeat) was added to
the schema file but hasn't been applied to the live database yet:

```bash
cd src/ui_test
npx wrangler d1 execute animedy-db --remote --file=../animedy_v1/queries/d1_ddl.sql -y
```

The whole file is safe to re-run — every statement is `CREATE TABLE IF NOT
EXISTS` / `CREATE INDEX IF NOT EXISTS`, so existing tables are untouched.

Verify:

```bash
npx wrangler d1 execute animedy-db --remote --command="SELECT name FROM sqlite_master WHERE type='table' AND name='user_activity';" -y
```

---

## 2. Set the secrets in Cloudflare Pages

Dashboard → Pages project `animedy` → **Settings → Environment variables**
(Production), or via CLI:

```bash
npx wrangler pages secret put JWT_SECRET --project-name=animedy
npx wrangler pages secret put TURNSTILE_SECRET --project-name=animedy
```

| Variable | Value |
|---|---|
| `JWT_SECRET` | Any long random string (e.g. output of `openssl rand -base64 48`). **Do not reuse** the MariaDB backend's dev secret. |
| `TURNSTILE_SECRET` | Your Turnstile **secret key** (pairs with the site key `0x4AAAAAAF0hMWYz9vJN4hVW` already embedded in the frontend). |

Notes:
- Without `JWT_SECRET`, register/login return a 500 ("JWT_SECRET is not configured").
- Without `TURNSTILE_SECRET`, auth still works — the Turnstile check is simply
  not enforced server-side until you set it. Set it to turn bot protection on.
- Also confirm the D1 binding exists on the Pages project: Settings →
  Functions → D1 database bindings → Variable name `DB` → database
  `animedy-db`. (Deploying with the new `wrangler.toml` from the CLI sets this
  up automatically.)

---

## 3. Deploy

```bash
cd src/ui_test
npm run build
npx wrangler pages deploy dist
```

`wrangler.toml` makes this pick up the `functions/` directory (the API) and
bind `DB` automatically. If you deploy through the dashboard/git integration
instead, make sure the build root is `src/ui_test` so `functions/` is included.

---

## 4. Create your admin account

1. Open the deployed site and **sign up normally** with the username you want.
2. Promote that account to admin:

```bash
npx wrangler d1 execute animedy-db --remote --command="UPDATE users SET role='admin' WHERE username='YOUR_USERNAME';" -y
```

3. **Sign out and sign back in** on the site (the role is baked into the JWT,
   so a fresh login is required for admin access to activate).
4. The **Admin** entry now appears in the More menu (desktop) / nav drawer
   (mobile), or go directly to `#/admin` — live sessions (guests included),
   who's watching what, and per-user stats. Your admin account watches anime
   like any normal account.

---

## Local development notes

- `npm run dev` (vite) proxies `/api` to port **3000** (the Node/MariaDB
  backend). To exercise the new account API locally instead:

  ```bash
  # terminal 1 — Pages Functions + local D1
  npx wrangler pages dev dist --port 8788 --persist-to /tmp/wrangler-state

  # terminal 2 — vite pointing its /api proxy at wrangler
  BACKEND_PORT=8788 npm run dev
  ```

- This repo sits on a CIFS network mount, so wrangler's local SQLite needs
  `--persist-to` pointing at a real local disk (as above), otherwise it fails
  with `SQLITE_BUSY`.
- Local function secrets come from `src/ui_test/.dev.vars` (gitignored, already
  created with a dev-only `JWT_SECRET`).
