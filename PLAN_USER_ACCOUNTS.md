# Plan: User Accounts & Cross-Device Data Sync

## 0. What already exists (don't rebuild)

- **Backend auth is already fully built**: `POST /register`, `POST /login`, `POST /me` (`src/animedy_v1/routes/auth.ts`, `handlers/auth.ts`).
  - `users` table with `UNIQUE` on `email` AND `username` — uniqueness is already enforced at the DB level and checked in `registerHandler` before insert.
  - Passwords hashed with `bcryptjs` (10 rounds), JWT (`jsonwebtoken`, 7d expiry) issued on register/login.
  - Current password rule is only `min(8).max(128)` in `schemas/auth.ts` — **not yet "strong."**
- **Per-user cloud sync already exists for settings only**: `user_settings` table + `GET/POST /settings` (`handlers/settings.ts`), plus `watch_progress` / `watch_state` tables for resume/continue-watching.
- **Everything else the user cares about (Liked, My List / custom lists, Watch Status) is 100% local-only right now** — `localStorage`/IndexedDB in `src/ui_test/src/lib/stores/likes.svelte.ts`, `customLists.svelte.ts`, `watchStatus.svelte.ts`, `db/local.ts`. No backend tables, no routes, no sync.
- **No sign-in/sign-up UI exists at all** in `src/ui_test/src/lib/pages` or components — needs to be built from scratch.

So this plan is really: (a) strengthen password rule, (b) add DB tables + endpoints for likes/custom-lists (watch status can reuse the same pattern), (c) build the auth UI, (d) build the "guest → sign up to save your data" prompt + local→cloud migration, (e) make every store multi-device-aware (cloud is source of truth when logged in, local is the offline cache/guest store).

---

## 1. Password strength policy

Replace the current `min(8)` rule in `authRegisterSchema` with something enforceable both client- and server-side:

- Min 10 characters, max 128.
- Must contain at least: 1 uppercase, 1 lowercase, 1 digit, 1 symbol.
- Reject top-10k common passwords (small bundled wordlist check, server-side only).
- Add a `zxcvbn`-style strength meter on the sign-up form (client-side, just a quick strength estimate, not a hard gate beyond the rules above).

Implementation: update `src/animedy_v1/schemas/auth.ts` with a `.regex()`/`.refine()` chain; mirror the same regex in the frontend form for instant feedback before hitting the API.

## 2. Username rule

Already unique at the DB (`uq_users_username`) and checked in the handler — just add a format rule (`3–20 chars, alnum + underscore`) to `authRegisterSchema` so people can't register usernames with spaces/emoji that break URLs later.

## 3. New DB tables (DDL additions to `src/animedy_v1/queries/ddl.sql`)

```sql
-- Liked anime (cloud mirror of likes.svelte.ts)
CREATE TABLE IF NOT EXISTS liked_anime (
  user_id BIGINT UNSIGNED NOT NULL,
  anime_id BIGINT UNSIGNED NOT NULL,
  liked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, anime_id),
  CONSTRAINT fk_liked_anime_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_liked_anime_anime FOREIGN KEY (anime_id) REFERENCES anime (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Custom lists ("My List" containers, e.g. "Comfort Rewatches")
CREATE TABLE IF NOT EXISTS custom_lists (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(128) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_custom_lists_user (user_id),
  CONSTRAINT fk_custom_lists_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS custom_list_entries (
  list_id BIGINT UNSIGNED NOT NULL,
  anime_id BIGINT UNSIGNED NOT NULL,
  added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (list_id, anime_id),
  CONSTRAINT fk_custom_list_entries_list FOREIGN KEY (list_id) REFERENCES custom_lists (id) ON DELETE CASCADE,
  CONSTRAINT fk_custom_list_entries_anime FOREIGN KEY (anime_id) REFERENCES anime (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Watch status (Watching/Completed/Plan to Watch/Dropped) — exclusive per anime
CREATE TABLE IF NOT EXISTS watch_status (
  user_id BIGINT UNSIGNED NOT NULL,
  anime_id BIGINT UNSIGNED NOT NULL,
  status ENUM('watching','completed','plan_to_watch','dropped') NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, anime_id),
  CONSTRAINT fk_watch_status_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_watch_status_anime FOREIGN KEY (anime_id) REFERENCES anime (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

Note: these FK to `anime.id`, so liking/listing an anime that isn't cached yet must first upsert it into `anime` (same pattern `progress`/`history` routes likely already use — check `queries/anime.ts` upsert helper and reuse it).

## 4. New backend endpoints (mirror the existing `settings` route shape exactly)

- `GET /likes`, `POST /likes/:anime_id`, `DELETE /likes/:anime_id`
- `GET /lists`, `POST /lists`, `DELETE /lists/:id`
- `GET /lists/:id/entries`, `POST /lists/:id/entries/:anime_id`, `DELETE /lists/:id/entries/:anime_id`
- `GET /watch-status`, `PUT /watch-status/:anime_id`

All behind `authRequired`. Each gets a `queries/*.ts` (raw SQL, no ORM, matching house style), a `schemas/*.ts` (Zod), a `handlers/*.ts`, a `routes/*.ts`, wired into `index.ts` same as `settingsRoutes`.

## 5. Guest vs. account mode — the actual UX flow requested

1. **First-run / existing users after this update**: a one-time non-blocking banner/modal — "Save your data across devices? Sign up free" — with "Not now" (dismiss, stays guest forever using local storage, can be opened later from Settings) and "Sign up".
2. **Sign up form**: email, username (live-check availability via a debounced `GET /auth/check-username`, new lightweight endpoint — doesn't exist yet, add it), password with strength meter, confirm password.
3. **On successful sign-up/login**: client gets `{ user, token }`. Store JWT in `localStorage` (or `httpOnly` cookie if you want more XSS resistance — worth a deliberate choice, see §7).
4. **Immediately after first successful auth**, run a one-time **migration pass**: push everything currently in local stores (`likes`, `customLists`, `watchStatus`, `settings`, `progress`) up to the matching new endpoints via bulk upsert calls, then mark migration done (flag in `localStorage`) so it never re-runs and never duplicates.
5. **From then on while logged in**: every store (`likes.svelte.ts`, `customLists.svelte.ts`, `watchStatus.svelte.ts`, `settings.svelte.ts`) becomes network-backed with local storage only as an **offline cache** — write-through: optimistic local update, fire API call, roll back on failure. On login on a *second* device, pull cloud data down and it just works — that's the whole point of the feature.
6. **Sign out**: clears the JWT; local caches stay as a snapshot (becomes the new "guest" state) or get wiped — product decision, recommend wiping to avoid confusing a different guest session with stale account data.

## 6. Frontend pieces to build

- `src/ui_test/src/lib/pages/SignUp.svelte`, `SignIn.svelte` (+ maybe a shared `AuthModal.svelte` if you want it as a modal instead of full page).
- `src/ui_test/src/lib/stores/auth.svelte.ts` — holds current user + token, `isLoggedIn`, login()/register()/logout()/checkUsername().
- `src/ui_test/src/lib/api/auth.ts` — thin fetch wrapper for the new endpoints, attaches `Authorization: Bearer <token>` (mirror `api/anilist.ts`/`client.ts` ApiError pattern already in the codebase).
- `src/ui_test/src/lib/sync/migrate.ts` — the one-time local→cloud push described in §5.4.
- A small `AccountPrompt.svelte` banner component for the "sign up to save your data" nudge, dismissible, re-offerable from Settings page.
- Update `Favorites.svelte`, `MyList.svelte`, `Settings.svelte` pages to call the store methods as-is (stores absorb the network logic, pages shouldn't need to change much).

## 7. Decisions to make before building (recommend defaults, flag if you disagree)

- **Token storage**: `localStorage` is simplest and matches "PWA, no server-rendered cookies" architecture already in place — recommend sticking with it over httpOnly cookies, given everything here is already a client-side SPA talking to a JSON API.
- **Conflict resolution** when a guest has local data AND later logs into an account that already has cloud data from another device: recommend **merge, don't overwrite** (union of liked anime, union of list entries) rather than picking one side — avoids silently losing watch history.
- **Does watch_status need its own table**, or should "My List" and "watch status" be unified? Recommend keeping them separate as outlined (matches the existing frontend separation already documented in `customLists.svelte.ts`'s own comments).

## 8. Build order

1. Harden password/username schemas (§1–2) — smallest, no new infra.
2. DDL + queries + handlers + routes for likes/lists/watch-status (§3–4), run against local MariaDB, hit with `curl`/Jest like the existing `__tests__` do for other routes.
3. Auth store + API client + Sign In/Sign Up pages (§6), wire into the router.
4. Guest-mode prompt banner (§5.1–2).
5. Migration pass (§5.4) — the trickiest part, test with an account that has zero cloud data first, then test re-login on a "second device" (just use a second browser profile) to confirm pull-down works.
6. Convert each local store to network-backed with offline fallback (§5.5), one store at a time, starting with `likes` (simplest shape) before `customLists` (has two tables) and `watchStatus`.
7. Sign-out handling + QA pass across guest/account/offline states.
