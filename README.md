<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0D0B1E,50:1A1533,100:2A1B4D&height=220&section=header&text=Animedy&fontSize=48&fontColor=E6DFFF&animation=fadeIn&fontAlignY=38&desc=Continuous%20Anime%20Watching%20Platform&descAlignY=60&descSize=18&descColor=A78BFA" alt="Animedy Header" width="100%"/>

<img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=500&size=16&duration=3200&pause=1000&color=A78BFA&center=true&vCenter=true&width=750&height=40&lines=Watch+entire+franchises+with+zero+friction.;Find+%E2%86%92+Play+%E2%86%92+Resume+%E2%86%92+Skip+Intro+%E2%86%92+Skip+Outro+%E2%86%92+Next+Season.;Svelte+5+%2B+shadcn-svelte+%2B+Tailwind+CSS+v4+%2B+Hono+%2B+MariaDB." alt="typing-svg"/>

<p align="center">
  <img src="https://img.shields.io/badge/Version-1.0.0-1A1533?style=for-the-badge&logo=git&logoColor=A78BFA&labelColor=0D0B1E&color=A78BFA" alt="Version"/>
  <img src="https://img.shields.io/badge/Status-In%20Active%20Development-1A1533?style=for-the-badge&logo=sparkles&logoColor=A78BFA&labelColor=0D0B1E&color=A78BFA" alt="Status"/>
  <img src="https://img.shields.io/badge/Architecture-Hono%20%2B%20Svelte%205-1A1533?style=for-the-badge&logo=svelte&logoColor=FF3E00&labelColor=0D0B1E&color=A78BFA" alt="Architecture"/>
  <img src="https://img.shields.io/badge/License-MIT-1A1533?style=for-the-badge&logo=open-source-initiative&logoColor=A78BFA&labelColor=0D0B1E&color=A78BFA" alt="License"/>
</p>

</div>

<br/>

## <img src="icons/sparkles.svg" width="22" height="22" align="center" /> Overview

**Animedy** is a continuous anime watching platform designed to eliminate the manual friction of anime viewing. Today, watching an anime franchise requires constant management: searching for sequel seasons, consulting watch-order guides, skipping repetitive opening/ending sequences, and manually remembering playback progress across devices.

Animedy transforms this experience into a seamless pipeline:
> **Find → Play → Resume → Skip Intro → Watch → Skip Outro → Next Episode → Next Season → Next Series**

All automated actions (autoplay, auto-next, intro/outro skipping, fullscreen) are fully configurable and user-overridable.

<br/>

<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=rect&color=0:0D0B1E,100:2A1B4D&height=2&width=850" alt="divider"/>
</div>

## <img src="icons/play.svg" width="22" height="22" align="center" /> Core Capabilities

<table>
<tr>
<td width="50%" valign="top">

### ⏩ Continuity & Continuation Engine
- **Franchise Tree Resolver:** Automatically walks prequel/sequel/side-story relation graphs to recommend the true chronological viewing order.
- **End-of-Series "What's Next?":** When an anime ends, the continuation engine calculates and suggests the next canonical sequel, movie, or spin-off.
- **Continue Watching Rail:** Home screen cards displaying season, part, episode, completion percentage, and remaining runtime.

</td>
<td width="50%" valign="top">

### ⏭️ Automated Skip & Timestamp System
- **AniSkip Integration:** Community-submitted intro and outro timestamps fetched via AniSkip API.
- **Automatic Seek:** Optional automated skipping with instant UI buttons during skip windows.
- **Manual Overrides:** Fallback mechanism allowing users and admins to define custom skip intervals.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 🎬 High-Performance Video Player
- **HTML5 & HLS Streaming:** Support for multi-quality streams and custom subtitle tracks.
- **Auto-Play & Auto-Next:** Seamless countdown overlay with manual cancel controls.
- **Mobile Experience:** Landscape auto-rotate via the Screen Orientation API and fullscreen support.

</td>
<td width="50%" valign="top">

### 🔄 Multi-Source Metadata & Sync
- **Metadata Sources:** User-selectable providers (**AniList** GraphQL and **Jikan / MyAnimeList** REST).
- **Cross-Device State:** 5-second debounced heartbeat synchronization against MariaDB.
- **Guest Offline Mode:** Complete IndexedDB storage layer for guest users, merging smoothly upon login.

</td>
</tr>
</table>

<br/>

<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=rect&color=0:0D0B1E,100:2A1B4D&height=2&width=850" alt="divider"/>
</div>

## <img src="icons/wrench-screwdriver.svg" width="22" height="22" align="center" /> Tech Stack & Ecosystem

### <img src="icons/globe-alt.svg" width="18" height="18" align="center" /> Frontend & Reactive Client (`src/ui_test/`)
<p>
  <img src="https://img.shields.io/badge/Svelte_5-1A1533?style=for-the-badge&logo=svelte&logoColor=FF3E00&labelColor=0D0B1E" alt="Svelte 5"/>
  <img src="https://img.shields.io/badge/Tailwind_CSS_v4-1A1533?style=for-the-badge&logo=tailwindcss&logoColor=38BDF8&labelColor=0D0B1E" alt="Tailwind CSS v4"/>
  <img src="https://img.shields.io/badge/shadcn--svelte-1A1533?style=for-the-badge&logo=shadcnui&logoColor=white&labelColor=0D0B1E" alt="shadcn-svelte"/>
  <img src="https://img.shields.io/badge/TypeScript-1A1533?style=for-the-badge&logo=typescript&logoColor=3178C6&labelColor=0D0B1E" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/PWA_Ready-1A1533?style=for-the-badge&logo=pwa&logoColor=5A0FC8&labelColor=0D0B1E" alt="PWA"/>
  <img src="https://img.shields.io/badge/IndexedDB-1A1533?style=for-the-badge&logo=sqlite&logoColor=003B57&labelColor=0D0B1E" alt="IndexedDB"/>
</p>

### <img src="icons/cog-6-tooth.svg" width="18" height="18" align="center" /> Backend & Micro-Services (`src/animedy_v1/`)
<p>
  <img src="https://img.shields.io/badge/Hono_v4-1A1533?style=for-the-badge&logo=hono&logoColor=E36002&labelColor=0D0B1E" alt="Hono"/>
  <img src="https://img.shields.io/badge/Node.js-1A1533?style=for-the-badge&logo=nodedotjs&logoColor=339933&labelColor=0D0B1E" alt="Node.js"/>
  <img src="https://img.shields.io/badge/Zod_Validation-1A1533?style=for-the-badge&logo=zod&logoColor=3E67B1&labelColor=0D0B1E" alt="Zod"/>
  <img src="https://img.shields.io/badge/JWT_Auth-1A1533?style=for-the-badge&logo=jsonwebtokens&logoColor=white&labelColor=0D0B1E" alt="JWT"/>
  <img src="https://img.shields.io/badge/bcrypt-1A1533?style=for-the-badge&logo=auth0&logoColor=EB5424&labelColor=0D0B1E" alt="bcrypt"/>
</p>

### <img src="icons/circle-stack.svg" width="18" height="18" align="center" /> Relational Database & Data Layer
<p>
  <img src="https://img.shields.io/badge/MariaDB-1A1533?style=for-the-badge&logo=mariadb&logoColor=003545&labelColor=0D0B1E" alt="MariaDB"/>
  <img src="https://img.shields.io/badge/mysql2%2Fpromise-1A1533?style=for-the-badge&logo=mysql&logoColor=4479A1&labelColor=0D0B1E" alt="mysql2"/>
  <img src="https://img.shields.io/badge/Raw_SQL_Queries-1A1533?style=for-the-badge&logo=databricks&logoColor=FF3621&labelColor=0D0B1E" alt="Raw SQL"/>
</p>

### <img src="icons/arrow-path.svg" width="18" height="18" align="center" /> External APIs & Providers
<p>
  <img src="https://img.shields.io/badge/AniList_GraphQL-1A1533?style=for-the-badge&logo=graphql&logoColor=E10098&labelColor=0D0B1E" alt="AniList GraphQL"/>
  <img src="https://img.shields.io/badge/Jikan_MyAnimeList-1A1533?style=for-the-badge&logo=myanimelist&logoColor=2E51A2&labelColor=0D0B1E" alt="Jikan REST"/>
  <img src="https://img.shields.io/badge/AniSkip_Timestamps-1A1533?style=for-the-badge&logo=fastapi&logoColor=009688&labelColor=0D0B1E" alt="AniSkip"/>
</p>

### <img src="icons/command-line.svg" width="18" height="18" align="center" /> Tooling, Quality & Documentation
<p>
  <img src="https://img.shields.io/badge/OpenAPI%2FSwagger-1A1533?style=for-the-badge&logo=swagger&logoColor=85EA2D&labelColor=0D0B1E" alt="Swagger"/>
  <img src="https://img.shields.io/badge/Jest-1A1533?style=for-the-badge&logo=jest&logoColor=C21325&labelColor=0D0B1E" alt="Jest"/>
  <img src="https://img.shields.io/badge/Supertest-1A1533?style=for-the-badge&logo=testinglibrary&logoColor=E33332&labelColor=0D0B1E" alt="Supertest"/>
  <img src="https://img.shields.io/badge/ESLint-1A1533?style=for-the-badge&logo=eslint&logoColor=4B32C3&labelColor=0D0B1E" alt="ESLint"/>
  <img src="https://img.shields.io/badge/Git-1A1533?style=for-the-badge&logo=git&logoColor=F05032&labelColor=0D0B1E" alt="Git"/>
</p>

<br/>

<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=rect&color=0:0D0B1E,100:2A1B4D&height=2&width=850" alt="divider"/>
</div>

## <img src="icons/code-bracket.svg" width="22" height="22" align="center" /> Directory Architecture

```text
animedy/
├── PRD.md                            # Canonical Product Requirements Document
├── CODING_CONVENTION_TECHSTACK.md    # Strict architecture & development rules
├── project_progress/                 # Task checklist & execution tracker
│   ├── animedy_TASKS_CHECKLIST.md
│   └── animedy_TASKS_TRACKER.md
├── src/
│   ├── animedy_v1/                   # Main Hono microservice
│   │   ├── handlers/                 # HTTP request handlers
│   │   │   ├── auth.ts               # Register, login, me
│   │   │   └── settings.ts           # User settings get/save
│   │   ├── routes/                   # Route declarations
│   │   ├── queries/                  # Raw SQL strings & ddl.sql
│   │   ├── schemas/                  # Zod request validation schemas
│   │   ├── interfaces/               # TypeScript data models
│   │   └── utils/                    # JWT, bcrypt, API clients (AniList, Jikan, AniSkip)
│   ├── jsondef/                      # Dedicated Swagger JSON definitions per endpoint
│   │   ├── POST_auth_login_schema.json
│   │   ├── POST_auth_me_schema.json
│   │   ├── POST_auth_register_schema.json
│   │   ├── POST_settings_get_schema.json
│   │   └── POST_settings_save_schema.json
│   ├── lib/                          # Protected infrastructure utilities
│   │   ├── dbconn.ts                 # MariaDB connection pool (IMMUTABLE)
│   │   └── errorlogger.ts            # Centralized error logging (IMMUTABLE)
│   └── ui_test/                      # Svelte 5 + Tailwind v4 + shadcn frontend
└── icons/                            # Tailwind Heroicons in brand accent
```

<br/>

<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=rect&color=0:0D0B1E,100:2A1B4D&height=2&width=850" alt="divider"/>
</div>

## <img src="icons/circle-stack.svg" width="22" height="22" align="center" /> MariaDB Relational Schema

All database models reside in `src/animedy_v1/queries/ddl.sql`:

| Table | Purpose | Primary / Unique Keys |
|---|---|---|
| `users` | User accounts, credentials, and authentication profiles | `id` (PK), `email` (UQ), `username` (UQ) |
| `user_settings` | Player preferences, automation toggles & source selections | `user_id` (PK, FK `users.id`) |
| `anime` | Cached anime metadata, titles, seasons, formats & franchise tags | `id` (PK), `anilist_id` (UQ), `mal_id` (IDX) |
| `anime_relations` | Cached prequel/sequel/side-story relation graph | `id` (PK), `(from_id, to_id, relation_type)` (UQ) |
| `episodes` | Self-hosted stream URLs, subtitles, qualities, thumbnails | `id` (PK), `(anime_id, episode_number)` (UQ) |
| `skip_timestamps` | Intro/outro/recap intervals (AniSkip cache + manual store) | `id` (PK), `(episode_id, skip_type, source)` (UQ) |
| `watch_progress` | Playback position (seconds), duration, completion flag | `id` (PK), `(user_id, episode_id)` (UQ) |
| `watch_state` | Current franchise pointer powering Continue Watching | `id` (PK), `(user_id, franchise_key)` (UQ) |

<br/>

<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=rect&color=0:0D0B1E,100:2A1B4D&height=2&width=850" alt="divider"/>
</div>

## <img src="icons/document-text.svg" width="22" height="22" align="center" /> API Specification (20 Endpoints)

All endpoints strictly use **POST** requests with JSON bodies (accepting `{}` when no arguments are required) and follow a standardized response envelope:

```json
{
  "success": true,
  "http_code": 200,
  "message": "Operation successful",
  "data": { ... }
}
```

<details>
<summary><b>Click to expand Endpoint Directory</b></summary>

<br/>

### 🔐 Authentication (`/api/auth/*`)
- `POST /api/auth/register` — Register a new account
- `POST /api/auth/login` — Authenticate and receive JWT Bearer token
- `POST /api/auth/me` — Validate token and return authenticated profile

### ⚙️ User Settings (`/api/settings/*`)
- `POST /api/settings/get` — Retrieve player settings and metadata/skip source selections
- `POST /api/settings/save` — Save player preferences and automation toggles

### 📺 Anime & Metadata (`/api/anime/*`, `/api/episodes/*`)
- `POST /api/anime/search` — Search titles via selected provider with server-side caching
- `POST /api/anime/details` — Detailed metadata (synonyms, format, seasons, arcs)
- `POST /api/anime/franchise` — Ordered franchise timeline and recommended viewing order
- `POST /api/anime/refresh` — Bust server cache and re-fetch from source
- `POST /api/episodes/list` — Episode catalog for an anime entry
- `POST /api/episodes/sources` — Video stream URLs, qualities, and subtitle tracks

### ⏭️ Skip Data (`/api/skip/*`)
- `POST /api/skip/get` — Intro/outro timestamps with fallback chain (`aniskip` → `manual`)
- `POST /api/skip/set` — Store manual skip timestamp overrides

### 📈 Progress & Continuation Engine (`/api/progress/*`, `/api/continue-watching/*`, `/api/watch-next/*`)
- `POST /api/progress/save` — Debounced heartbeat saving current playback position
- `POST /api/progress/get` — Retrieve saved playback position
- `POST /api/progress/complete` — Mark episode complete and advance watch state pointer
- `POST /api/continue-watching/list` — Continue Watching rail with percentage and remaining time
- `POST /api/watch-next/get` — Continuation engine: next episode → next season → sequel → movie → franchise
- `POST /api/history/list` — Paginated user viewing history

### 🛡️ Administration (`/api/admin/*`)
- `POST /api/admin/episodes/upsert` — Attach self-hosted stream URLs, qualities, and subtitles

</details>

<br/>

<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=rect&color=0:0D0B1E,100:2A1B4D&height=2&width=850" alt="divider"/>
</div>

## <img src="icons/rocket-launch.svg" width="22" height="22" align="center" /> Getting Started

### Prerequisites
- **Node.js:** v20+ / v22+
- **MariaDB / MySQL:** v10.5+ / v8.0+
- **npm** or **pnpm**

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/villariasa/animedy.git
cd animedy
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and configure your credentials:
```bash
cp .env.example .env
```
```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=animedy_db
JWT_SECRET=your_super_secret_jwt_key
```

### 3. Initialize MariaDB Schema
Execute the DDL schema to provision all 8 core tables:
```bash
mysql -u root -p animedy_db < src/animedy_v1/queries/ddl.sql
```

### 4. Run Development Server
```bash
npm run dev
```
The Hono backend will start on `http://localhost:3000`.

### 5. Run Test Suite
```bash
npm test
```

<br/>

---

<p align="center">
  Built with ❤️ for anime enthusiasts. Architected by <a href="https://github.com/villariasa">villariasa</a>.
</p>
