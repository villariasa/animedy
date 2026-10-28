# PRD — Animedy v1

**Full Project Name:** Animedy — Continuous Anime Watching Platform
**Abbreviated Path:** `src/animedy_v1/`
**Version:** 1
**Date:** 2026-10-28
**Status:** DRAFT — awaiting approval

---

## 1. Problem Statement

Watching an anime franchise today requires constant manual management: finding the next episode, skipping intros/outros by hand, remembering where you stopped, and researching ("what comes after Naruto?") which season, part, movie, or sequel series to watch next. Every entry is treated as a separate anime, so continuity across seasons, parts, arcs, movies, OVAs, and sequel series is lost.

## 2. Goal

> The user chooses an anime, presses play, and keeps watching the entire franchise with as little manual management as possible:
> **Find → Play → Resume → Skip Intro → Watch → Skip Outro → Next Episode → Next Season → Next Series**

All automatic behavior must be user-overridable (toggles + manual buttons).

## 3. Project Context

- **Backend:** Hono + TypeScript (strict), Zod validation, MariaDB (raw SQL queries in `queries/`), JWT auth.
- **Frontend:** Svelte 5 (runes `$state`, `$derived`, `$effect`) + **shadcn-svelte** + Tailwind CSS v4, PWA, in `src/ui_test`.
- **Video hosting:** Self-hosted — the operator deploys and hosts video files (MP4/HLS). The backend stores and serves stream URLs per episode; no third-party video scraping.
- **External APIs (metadata/skip "servers" — user-selectable source per feature):**
  | Service | Purpose | Notes |
  |---|---|---|
  | **AniList** (GraphQL) | Primary metadata: titles, relations (prequel/sequel/side story/spin-off/alternative), seasons, dates, format, status, episodes, duration, covers | Primary source |
  | **Jikan (MyAnimeList)** (REST) | Fallback/enrichment metadata source; selectable as alternate metadata server | Fallback source |
  | **AniSkip** (REST) | Community intro/outro timestamps (by MAL id + episode) | Primary skip source; manual/stored timestamps as fallback |
- The UI exposes a **source selector** ("Metadata server: AniList / MAL", "Skip server: AniSkip / Manual") with AniList + AniSkip as defaults.
- **Directory structure:** `routes/`, `handlers/`, `queries/`, `schemas/`, `interfaces/`, `utils/`, `lib/` under `src/animedy_v1/`; Swagger JSON per endpoint in `src/jsondef/`.
- **Immutable:** `src/lib/dbconn.ts`, `src/lib/errorlogger.ts`.
- **All endpoints are POST.** Empty body = `{}`.
- **HTTP response format:** `{ success, http_code, message, data }`.

## 4. Data Model (MariaDB — all new tables)

### 4.1 `users`
| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK AUTO_INCREMENT | |
| email | VARCHAR(255) UNIQUE NOT NULL | |
| username | VARCHAR(64) UNIQUE NOT NULL | |
| password_hash | VARCHAR(255) NOT NULL | bcrypt |
| created_at / updated_at | DATETIME | |

### 4.2 `user_settings` (remembered player settings + preferences)
| Column | Type | Notes |
|---|---|---|
| user_id | BIGINT UNSIGNED PK, FK users.id | 1:1 |
| volume | TINYINT UNSIGNED DEFAULT 100 | 0–100 |
| playback_speed | DECIMAL(3,2) DEFAULT 1.00 | |
| subtitle_lang | VARCHAR(16) DEFAULT 'en' | |
| preferred_quality | VARCHAR(16) DEFAULT 'auto' | |
| autoplay | TINYINT(1) DEFAULT 1 | |
| auto_next | TINYINT(1) DEFAULT 1 | |
| auto_skip_intro | TINYINT(1) DEFAULT 1 | |
| auto_skip_outro | TINYINT(1) DEFAULT 1 | |
| auto_fullscreen | TINYINT(1) DEFAULT 0 | |
| countdown_seconds | TINYINT UNSIGNED DEFAULT 10 | auto-next countdown |
| metadata_source | ENUM('anilist','mal') DEFAULT 'anilist' | server selection |
| skip_source | ENUM('aniskip','manual') DEFAULT 'aniskip' | server selection |
| updated_at | DATETIME | |

### 4.3 `anime` (cached metadata layer)
| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK AUTO_INCREMENT | internal id |
| anilist_id | INT UNSIGNED UNIQUE | |
| mal_id | INT UNSIGNED NULL, INDEX | for AniSkip/Jikan |
| title_romaji / title_english / title_native | VARCHAR(512) | |
| synonyms | JSON | alternative titles |
| format | ENUM('TV','MOVIE','OVA','ONA','SPECIAL','TV_SHORT','MUSIC') | |
| status | ENUM('FINISHED','RELEASING','NOT_YET_RELEASED','CANCELLED','HIATUS') | |
| season | ENUM('WINTER','SPRING','SUMMER','FALL') NULL | |
| season_year | SMALLINT NULL | |
| start_date / end_date | DATE NULL | exact release dates |
| episode_count | SMALLINT UNSIGNED NULL | |
| episode_duration | SMALLINT UNSIGNED NULL | minutes |
| description | TEXT | |
| cover_image / banner_image | VARCHAR(1024) | |
| franchise_key | VARCHAR(64) INDEX | groups related entries (root anilist id of the relation graph) |
| sequence_order | SMALLINT NULL | computed recommended viewing order within franchise |
| season_label | VARCHAR(128) NULL | e.g. "Season 3 Part 2" |
| arc_name | VARCHAR(255) NULL | when reliable arc metadata exists |
| metadata_json | JSON | full raw cached payload |
| cached_at | DATETIME | server-side cache TTL control |

### 4.4 `anime_relations` (cached relation graph)
| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK | |
| from_anime_id | BIGINT UNSIGNED FK anime.id | |
| to_anime_id | BIGINT UNSIGNED FK anime.id | |
| relation_type | ENUM('PREQUEL','SEQUEL','SIDE_STORY','SPIN_OFF','ALTERNATIVE','PARENT','SAME_UNIVERSE','SOURCE','ADAPTATION','SUMMARY','CHARACTER','OTHER') | |
| UNIQUE(from_anime_id, to_anime_id, relation_type) | | |

### 4.5 `episodes`
| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK | |
| anime_id | BIGINT UNSIGNED FK anime.id | |
| episode_number | SMALLINT UNSIGNED | UNIQUE(anime_id, episode_number) |
| title | VARCHAR(512) NULL | |
| duration_seconds | INT UNSIGNED NULL | |
| air_date | DATE NULL | |
| thumbnail | VARCHAR(1024) NULL | |
| stream_url | VARCHAR(1024) NOT NULL | self-hosted MP4/HLS URL |
| subtitles_json | JSON NULL | `[ {lang, label, url} ]` |
| qualities_json | JSON NULL | `[ {label, url} ]` |

### 4.6 `skip_timestamps` (per-series/per-episode skip data; manual overrides + AniSkip cache)
| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK | |
| episode_id | BIGINT UNSIGNED FK episodes.id | |
| skip_type | ENUM('intro','outro','recap') | |
| start_seconds / end_seconds | INT UNSIGNED | |
| source | ENUM('aniskip','manual') | |
| UNIQUE(episode_id, skip_type, source) | | |

### 4.7 `watch_progress` (resume + cross-device sync; one row per user+episode)
| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK | |
| user_id / episode_id | FK, UNIQUE(user_id, episode_id) | |
| position_seconds | INT UNSIGNED | exact playback position |
| duration_seconds | INT UNSIGNED | denormalized for % calc |
| completed | TINYINT(1) DEFAULT 0 | ≥90% watched |
| last_watched_at | DATETIME INDEX | |

### 4.8 `watch_state` (current pointer per user+franchise → powers Continue Watching / Watch Next)
| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK | |
| user_id | FK, INDEX | |
| franchise_key | VARCHAR(64) | UNIQUE(user_id, franchise_key) |
| current_anime_id / current_episode_id | FK | |
| series_completed | TINYINT(1) DEFAULT 0 | |
| franchise_completed | TINYINT(1) DEFAULT 0 | |
| last_watched_at | DATETIME INDEX | ordering of Continue Watching |

## 5. API Endpoints (all POST, JWT-protected unless noted)

Response: `{ success, http_code, message, data }`. Each endpoint has a dedicated Swagger JSON file in `src/jsondef/`.

### Auth (public)
| # | Route | Purpose | Swagger file |
|---|---|---|---|
| 1 | `/api/auth/register` | Create account | `POST_auth_register_schema.json` |
| 2 | `/api/auth/login` | Login → JWT | `POST_auth_login_schema.json` |
| 3 | `/api/auth/me` | Validate token, return profile (`{}` body) | `POST_auth_me_schema.json` |

### Anime & metadata (AniList/Jikan proxy + server cache)
| # | Route | Purpose | Swagger file |
|---|---|---|---|
| 4 | `/api/anime/search` | Search anime (proxies selected metadata source, caches results) | `POST_anime_search_schema.json` |
| 5 | `/api/anime/details` | Full details incl. titles, dates, format, status, season/part label, arcs | `POST_anime_details_schema.json` |
| 6 | `/api/anime/franchise` | Full franchise graph: ordered seasons/parts/movies/OVAs + recommended viewing order | `POST_anime_franchise_schema.json` |
| 7 | `/api/anime/refresh` | Force re-fetch metadata from external source (cache bust) | `POST_anime_refresh_schema.json` |
| 8 | `/api/episodes/list` | Episode list for an anime | `POST_episodes_list_schema.json` |
| 9 | `/api/episodes/sources` | Stream URL, qualities, subtitles for an episode | `POST_episodes_sources_schema.json` |

### Skip data (AniSkip proxy + manual store)
| # | Route | Purpose | Swagger file |
|---|---|---|---|
| 10 | `/api/skip/get` | Intro/outro timestamps for episode (selected skip source, fallback chain aniskip→manual) | `POST_skip_get_schema.json` |
| 11 | `/api/skip/set` | Store/override manual skip timestamps | `POST_skip_set_schema.json` |

### Progress, history & continuation engine
| # | Route | Purpose | Swagger file |
|---|---|---|---|
| 12 | `/api/progress/save` | Save playback position (debounced heartbeat from player) | `POST_progress_save_schema.json` |
| 13 | `/api/progress/get` | Resume position for an episode | `POST_progress_get_schema.json` |
| 14 | `/api/progress/complete` | Mark episode complete, advance `watch_state` pointer | `POST_progress_complete_schema.json` |
| 15 | `/api/continue-watching/list` | Continue Watching section (title, season/part, episode, %, remaining time) | `POST_continue_watching_list_schema.json` |
| 16 | `/api/watch-next/get` | Continuation engine: next episode → next season/part → sequel → movie → special/OVA → franchise recommendation | `POST_watch_next_get_schema.json` |
| 17 | `/api/history/list` | Watch history (episodes, completions, dates) | `POST_history_list_schema.json` |

### Settings
| # | Route | Purpose | Swagger file |
|---|---|---|---|
| 18 | `/api/settings/get` | Fetch user player settings + source selections (`{}`) | `POST_settings_get_schema.json` |
| 19 | `/api/settings/save` | Save settings (volume, speed, subs, quality, toggles, sources) | `POST_settings_save_schema.json` |

### Admin / content management
| # | Route | Purpose | Swagger file |
|---|---|---|---|
| 20 | `/api/admin/episodes/upsert` | Attach self-hosted stream URLs/subtitles/qualities to episodes | `POST_admin_episodes_upsert_schema.json` |

## 6. External API Handling

- All external calls go through Hono backend handlers (`utils/anilist.ts`, `utils/jikan.ts`, `utils/aniskip.ts`) — the browser never calls external APIs directly.
- **AniList:** GraphQL POST to `https://graphql.anilist.co`, requesting only needed fields (titles, dates, season, seasonYear, episodes, duration, format, status, relations, coverImage, idMal).
- **Jikan:** REST `https://api.jikan.moe/v4` as fallback/alternate metadata server; mapped into the same `anime` cache shape.
- **AniSkip:** REST `https://api.aniskip.com` by `mal_id` + episode number; results cached into `skip_timestamps` with `source='aniskip'`.
- **Fallback chain:** selected source → other source → stale cache. On total failure return `success:false` with `http_code` 502 and a clear message; cached data is served when available (stale-while-revalidate).
- **Rate limiting:** respect AniList (~90 req/min) and Jikan (~3 req/sec) limits via per-source throttle in `utils/`; server cache TTL 24h for metadata, 7d for relations, permanent for skip timestamps (refresh on demand).
- **Franchise order computation:** on first fetch, walk AniList relations (SEQUEL edges primarily), compute `franchise_key` + `sequence_order` (by relation chain, then start_date), persist to `anime` + `anime_relations`.

## 7. Frontend Requirements (Svelte 5 + shadcn-svelte + Tailwind v4, PWA, in `src/ui_test`)

### Pages
1. **Home** — search, trending/recent, **Continue Watching** rail (card: title, season/part, episode no + title, progress bar %, remaining time, Continue button).
2. **Anime detail** — full metadata (all titles, release year/date, season, part, episode count, duration, status, format), franchise timeline (ordered seasons/parts/movies/OVAs/arcs), episode list, "Watch Next" banner if history exists.
3. **Watch page (player)** — the core experience.
4. **History** and **Settings** pages.

### Player (custom HTML5/HLS player component)
- Controls: play/pause, seek, volume, subtitle selection, quality, speed, fullscreen, PiP, Skip Intro, Skip Outro, prev/next episode, episode list drawer, Auto Play toggle, Auto Next toggle.
- Keyboard shortcuts: space (play/pause), ←/→ (seek ±5s), ↑/↓ (volume), F (fullscreen), M (mute), N (next), S (skip segment).
- Mobile-friendly controls; **auto-rotate to landscape** on mobile fullscreen via Screen Orientation API where supported; **auto-fullscreen** on play where permitted (user-gesture gated).
- **Auto play** when ready; **auto next** on ended with a shadcn Dialog/overlay **countdown** (configurable seconds, Cancel button).
- **Auto skip intro/outro**: `$effect` watching currentTime against skip windows → auto-seek when enabled; temporary "Skip Intro"/"Skip Outro" shadcn Buttons shown during windows regardless of auto setting.
- **Resume**: on load, fetch `/api/progress/get` (logged in) or IndexedDB (guest), seek to saved position; heartbeat save every 5s + on pause/unload.
- **End of series** → "What's Next?" overlay from `/api/watch-next/get`: Next Season / Next Part / Sequel Series / Related Movie / Specials with a **Watch Next** button.

### State & caching (client)
- Runes: `$state` for player/session state, `$derived` for progress %/remaining time/active skip window, `$effect` for heartbeat, skip detection, orientation/fullscreen.
- **IndexedDB** (`idb`): guest watch progress, player settings, metadata cache. Logged-in: server is source of truth, IndexedDB as offline cache; merge on login (newest `last_watched_at` wins).
- PWA: manifest + service worker (cache shell + metadata GETs are POST → runtime cache via IndexedDB layer instead).

## 8. Security

- JWT (HS256) via `Authorization: Bearer`; middleware on all non-auth routes.
- Guest mode: browse/watch with local-only progress; auth required for cross-device sync, history, settings persistence.
- bcrypt password hashing; Zod validation on every request body; admin endpoint gated by `role='admin'` claim.
- No secrets in frontend; external API calls server-side only.

## 9. Testing Strategy

- **Jest + Supertest:** every endpoint (success, validation failure, auth failure); external APIs mocked (AniList GraphQL, Jikan, AniSkip fixtures: Bleach/Naruto/AoT franchise graphs); continuation-engine priority order unit tests; fallback-chain tests (source down → fallback → stale cache).
- **Svelte component tests:** player controls, countdown overlay, skip-button visibility windows, Continue Watching card math (%, remaining time).
- **ESLint** mandatory, TypeScript strict.
- Verify Swagger UI dynamically loads all 20 JSON files from `src/jsondef/`.

## 10. Out of Scope (v1)

- Video transcoding/upload pipeline (operator hosts files and registers URLs via admin endpoint).
- Generic taste-based recommendations (engine is continuation-only).
- Comments, ratings, social features.
