# Animedy — Coding Convention & Tech Stack (Source of Truth)

Derived from the approved `PRD.md` (2026-10-28). Binding for all workers.

## Tech Stack
- **Backend:** Hono (TypeScript, strict, ESM) on Node.js
- **Database:** MariaDB — raw SQL string queries only (no ORM); `mysql2/promise` driver via `src/lib/dbconn.ts`
- **Validation:** Zod on every request body
- **Auth:** JWT (HS256), `Authorization: Bearer`; bcrypt for passwords
- **Docs:** OpenAPI/Swagger — one JSON file per endpoint in `src/jsondef/`, named `POST_<route>_schema.json`; Swagger UI loads them dynamically
- **Frontend:** Svelte 5 (runes `$state`/`$derived`/`$effect`) + Tailwind CSS v4 + shadcn-svelte, PWA-capable, in `src/ui_test/`
- **Testing:** Jest + Supertest (backend, external APIs mocked), Svelte component tests (Vitest + Testing Library), ESLint mandatory

## Directory Structure (STRICT)
```
src/animedy_v1/
  routes/      # all Hono route definitions
  handlers/    # all request handlers
  queries/     # all MariaDB SQL string queries (+ ddl.sql)
  schemas/     # all Zod schemas
  interfaces/  # all TypeScript interfaces
  utils/       # utilities (auth, anilist, jikan, aniskip, throttle, franchise)
  lib/         # shared libs
src/lib/       # dbconn.ts, errorlogger.ts  ← IMMUTABLE once created
src/jsondef/   # one Swagger JSON per endpoint
src/ui_test/   # Svelte 5 frontend
project_progress/  # checklist, tracker, restore points
```
Never invent other layouts; never relocate files across these folders without user approval.

## API Rules
- **All endpoints are POST.** No body needed → accept `{}`.
- **HTTP response envelope:** `{ success: boolean, http_code: number, message: string, data: object|null }`
- **Stored procedure envelope (if used):** `{ success, message, json_data }`
- External APIs (AniList GraphQL, Jikan REST, AniSkip REST) are called **server-side only**, throttled, and cached per PRD §6. Never from the browser.
- Any endpoint code change must immediately update its Swagger JSON in `src/jsondef/`.

## Code Quality
- TypeScript `strict: true`, ESM modules
- ESLint must pass; single exit point per function where practical; max ~300 lines per file
- No hardcoded secrets — use `.env` (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `PORT`); never paste values into code, logs, or trackers

## Protected Files (do not modify once created)
- `src/lib/dbconn.ts`
- `src/lib/errorlogger.ts`

## Required Reads Before Coding
- `PRD.md`
- `project_progress/animedy_TASKS_CHECKLIST.md` (this project's canonical checklist; `animedy_TASKS_TRACKER.md` is the canonical tracker)

## Testing Requirements
- Every completed endpoint needs Jest/Supertest coverage (success, Zod validation failure, auth failure) before its task is marked done
- External API fixtures: Bleach / Naruto / Attack on Titan franchise graphs
- Sample data sourced from the real affected DB tables where a live DB is available
