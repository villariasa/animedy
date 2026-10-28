# Animedy — Continuous Anime Watching Platform: Task Checklist

**Project path:** `src/animedy_v1/` · **PRD:** `PRD.md` · **Status:** COMPLETE — all 6 phases done (2026-10-28)

## Phase 1: Database & Schema
- [x] T1.1 — Create MariaDB DDL for all 8 tables (`users`, `user_settings`, `anime`, `anime_relations`, `episodes`, `skip_timestamps`, `watch_progress`, `watch_state`) in `src/animedy_v1/queries/ddl.sql`
- [x] T1.2 — Create TypeScript interfaces for all tables and API payloads in `src/animedy_v1/interfaces/`
- [x] T1.3 — Create Zod schemas for all 20 endpoint request bodies in `src/animedy_v1/schemas/`
- [x] T1.4 — Write SQL query strings (CRUD + continuation queries) in `src/animedy_v1/queries/`

## Phase 2: Backend Core (Hono)
- [x] T2.1 — JWT auth middleware + bcrypt utils in `src/animedy_v1/utils/auth.ts` (uses immutable `src/lib/dbconn.ts`, `src/lib/errorlogger.ts`)
- [x] T2.2 — Auth endpoints: `/api/auth/register`, `/api/auth/login`, `/api/auth/me` (handlers + routes + Swagger JSONs `POST_auth_*_schema.json`)
- [x] T2.3 — Settings endpoints: `/api/settings/get`, `/api/settings/save` (+ Swagger JSONs)

## Phase 3: External API Layer (server-side proxies + cache)
- [x] T3.1 — AniList GraphQL client with throttle + 24h cache in `src/animedy_v1/utils/anilist.ts`
- [x] T3.2 — Jikan REST client with throttle, mapped to same cache shape, in `src/animedy_v1/utils/jikan.ts`
- [x] T3.3 — AniSkip client caching into `skip_timestamps` in `src/animedy_v1/utils/aniskip.ts`
- [x] T3.4 — Source fallback chain (selected → other → stale cache) + franchise graph walker computing `franchise_key` / `sequence_order`
- [x] T3.5 — Metadata endpoints: `/api/anime/search`, `/api/anime/details`, `/api/anime/franchise`, `/api/anime/refresh` (+ Swagger JSONs)
- [x] T3.6 — Episode endpoints: `/api/episodes/list`, `/api/episodes/sources` + admin `/api/admin/episodes/upsert` (+ Swagger JSONs)
- [x] T3.7 — Skip endpoints: `/api/skip/get` (aniskip→manual fallback), `/api/skip/set` (+ Swagger JSONs)

## Phase 4: Continuation Engine & Progress
- [x] T4.1 — Progress endpoints: `/api/progress/save` (heartbeat), `/api/progress/get`, `/api/progress/complete` (advances `watch_state`) (+ Swagger JSONs)
- [x] T4.2 — `/api/continue-watching/list` with %, remaining time, season/part label (+ Swagger JSON)
- [x] T4.3 — `/api/watch-next/get` priority engine: next episode → next season/part → sequel → movie → special/OVA → franchise recommendation (+ Swagger JSON)
- [x] T4.4 — `/api/history/list` (+ Swagger JSON)
- [x] T4.5 — Swagger UI dynamically loading all 20 JSON files from `src/jsondef/`

## Phase 5: Frontend (Svelte 5 + shadcn-svelte + Tailwind v4, in `src/ui_test`)
- [x] T5.1 — Project shell: Tailwind v4 + shadcn-svelte setup, PWA manifest + service worker, API client (`$state` auth/session store)
- [x] T5.2 — Home page: search, Continue Watching rail (progress %, remaining time, Continue button)
- [x] T5.3 — Anime detail page: full metadata, franchise timeline (seasons/parts/arcs ordered), episode list, Watch Next banner
- [x] T5.4 — Player component: HTML5/HLS, all controls (play/seek/volume/subs/quality/speed/fullscreen/PiP/prev/next/episode drawer), keyboard shortcuts, mobile controls
- [x] T5.5 — Player automation: autoplay, auto-next countdown overlay with cancel, auto/manual skip intro-outro (`$effect` on currentTime), resume + 5s heartbeat, auto-fullscreen + mobile auto-rotate
- [x] T5.6 — End-of-series "What's Next?" overlay with Watch Next button
- [x] T5.7 — IndexedDB layer: guest progress/settings, offline cache, merge-on-login (newest `last_watched_at` wins)
- [x] T5.8 — Settings page (player prefs, automation toggles, metadata/skip source selectors) + History page

## Phase 6: Testing & Validation
- [x] T6.1 — Jest/Supertest: auth, settings, metadata (mocked AniList/Jikan fixtures: Bleach/Naruto/AoT), skip, progress endpoints — success/validation/auth-failure each
- [x] T6.2 — Unit tests: continuation-engine priority order + franchise ordering + fallback chain
- [x] T6.3 — Svelte component tests: player controls, countdown, skip-button windows, Continue Watching card math
- [x] T6.4 — ESLint + TypeScript strict pass; verify Swagger UI loads all 20 JSON definitions
