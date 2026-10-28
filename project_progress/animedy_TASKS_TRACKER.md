# Animedy — Tasks Tracker

**PRD:** `PRD.md` (APPROVED 2026-10-28)
**Checklist:** `project_progress/animedy_TASKS_CHECKLIST.md`

## Current Status
- **Phase:** 3 — External API Layer (server-side proxies + cache)
- **Next task:** T3.1 — AniList GraphQL client with throttle + 24h cache in `src/animedy_v1/utils/anilist.ts`
- **Completed:** 7 / 33 tasks
- **Blockers:** none

## Log
| Date | Task | Status | Notes |
|---|---|---|---|
| 2026-10-28 | PRD + checklist generated | Done | prd-craft; approved by user. Handed off to dev-orchestrator. |
| 2026-10-28 | Bootstrap (package.json, tsconfig, eslint.config.js, jest.config.ts, .env.example, .gitignore, src/lib/dbconn.ts, src/lib/errorlogger.ts) | Done | backend-coder; `npm install --no-bin-links` (symlinks unsupported on this filesystem); `npx tsc --noEmit` clean. |
| 2026-10-28 | T1.1 — ddl.sql (8 tables) | Done | backend-coder; added `users.role` ENUM('user','admin') not explicit in PRD §4.1 but required by §8 admin gating — noted as deviation. |
| 2026-10-28 | T1.2 — interfaces/db.ts, interfaces/api.ts, interfaces/external.ts | Done | backend-coder; db row types, ApiResponse<T> envelope + all 20 endpoint req/resp payloads, AniList/Jikan/AniSkip external shapes. |
| 2026-10-28 | T1.3 — schemas/{auth,anime,episodes,skip,progress,settings,admin,index}.ts | Done | backend-coder; Zod `.strict()` schemas for all 20 endpoint bodies; empty-body endpoints use `z.object({}).strict()`. |
| 2026-10-28 | T1.4 — queries/{users,settings,anime,episodes,skip,progress,history}.ts | Done | backend-coder; parameterized SQL string modules aligned to ddl.sql; includes continue-watching join and watch_state advance queries. |
| 2026-10-28 | Verification (Phase 1) | Done | backend-coder; `tsc --noEmit` and `eslint src` both pass with 0 errors/warnings (invoked via `node node_modules/<pkg>/bin/...` since no-bin-links left no `.bin` symlinks on this filesystem). |
| 2026-10-28 | T2.1 — utils/auth.ts | Done | backend-coder; bcryptjs hash/verify (10 rounds), JWT HS256 sign/verify (7d expiry, payload `{user_id, username, role}`), `authRequired`/`adminRequired` Hono middleware returning 401/403 envelopes, claims attached via `context.set("jwtClaims", ...)`. |
| 2026-10-28 | T2.2 — Auth endpoints | Done | backend-coder; handlers/auth.ts + routes/auth.ts for register/login/me; register checks unique email/username (409), hashes password, inserts default `user_settings` row, returns JWT+profile; login verifies bcrypt (401 on mismatch); me requires auth, returns profile + has_settings. Added `AuthMeResponse.has_settings` field to interfaces/api.ts (minor extension, not a deviation from PRD intent). Swagger JSONs: POST_auth_register_schema.json, POST_auth_login_schema.json, POST_auth_me_schema.json. |
| 2026-10-28 | T2.3 — Settings endpoints | Done | backend-coder; handlers/settings.ts + routes/settings.ts for get/save; get auto-creates default settings row if missing; save does partial merge via Zod `settingsSaveSchema` then UPSERT. Swagger JSONs: POST_settings_get_schema.json, POST_settings_save_schema.json. |
| 2026-10-28 | App entry + verification (Phase 2) | Done | backend-coder; src/animedy_v1/index.ts mounts /api/auth, /api/settings, global onError/notFound using logError + envelope, @hono/node-server listen on PORT (guarded by NODE_ENV!=='test'), POST /docs/index + POST /docs/file serving src/jsondef/ dynamically (final Swagger UI wiring deferred to T4.5 per plan). Fixed tsconfig `rootDir` from `.` to `src` so `dist/` output matches `package.json` start script. `tsc --noEmit` and `eslint src` clean; smoke-tested via tsx: /api/auth/me returns 401 envelope without token, /docs/index lists all 5 jsondef files in dev mode. Noted TODO: production build (`npm run build`) does not copy `src/jsondef/` into `dist/`, so `/docs/*` needs a copy step or path fix before deploying built output — flag for T4.5/build task. |
