# Animedy — Cloudflare D1 Database & Sync Reference

This document contains credentials, links, and schema details for the Cloudflare D1 database setup powering **User Accounts & Cross-Device Data Sync** (based on `PLAN_USER_ACCOUNTS.md`).

---

## 1. Cloudflare D1 Database Details

- **Account Email**: `medyvillarias36@gmail.com`
- **Account ID**: `42cd6827b074b6fa8b7a040dd9962bcf`
- **Database Name**: `animedy-db`
- **Database UUID**: `e00b316c-2119-4b2e-85fc-65b431e8b40f`
- **Pages Project**: `animedy` (`animedy.pages.dev`)

### Direct Links
- **D1 Console (Inspect tables & run SQL)**:  
  [https://dash.cloudflare.com/42cd6827b074b6fa8b7a040dd9962bcf/workers-and-pages/d1/databases/e00b316c-2119-4b2e-85fc-65b431e8b40f](https://dash.cloudflare.com/42cd6827b074b6fa8b7a040dd9962bcf/workers-and-pages/d1/databases/e00b316c-2119-4b2e-85fc-65b431e8b40f)

- **Pages Function Bindings (Bind `animedy-db` to `animedy.pages.dev`)**:  
  [https://dash.cloudflare.com/42cd6827b074b6fa8b7a040dd9962bcf/pages/view/animedy/settings/functions](https://dash.cloudflare.com/42cd6827b074b6fa8b7a040dd9962bcf/pages/view/animedy/settings/functions)  
  *Set Variable Name = `DB`, D1 Database = `animedy-db`*

---

## 2. Active Tables in `animedy-db`

The schema has been migrated to SQLite syntax and is stored in `src/animedy_v1/queries/d1_ddl.sql`.

### User Accounts & Sync (from `PLAN_USER_ACCOUNTS.md`)
- `liked_anime`: `(user_id, anime_id, liked_at)` — Cloud mirror of likes store
- `custom_lists`: `(id, user_id, name, created_at)` — Custom list containers
- `custom_list_entries`: `(list_id, anime_id, added_at)` — Entries within custom lists
- `watch_status`: `(user_id, anime_id, status, updated_at)` — Watching, Completed, Plan to Watch, Dropped

### Core Authentication & User
- `users`: `(id, email, username, password_hash, role, avatar_url, created_at, updated_at)`
- `user_settings`: `(user_id, volume, playback_speed, subtitle_lang, ...)`

### Anime & Episode Metadata
- `anime`: Cached anime metadata layer
- `anime_relations`: Prequel, sequel, spin-off relation graph
- `episodes`: Stream URLs, thumbnails, subtitles, qualities
- `skip_timestamps`: Intro/outro skip windows (`aniskip` or `manual`)

### Playback & Continuation Engine
- `watch_progress`: Playback position and completion tracking
- `watch_state`: Current franchise pointer for the Continue Watching rail

### Presence & Live Chat (from `PLAN_GLOBAL_CHAT.md`)
- `user_activity`: Presence & heartbeat session tracking for admin monitoring
- `chat_messages`: `(id, user_id, username, avatar_url, body, deleted, created_at)` — Global chat messages with avatar
- `chat_mutes`: `(user_id, reason, muted_by, muted_until, created_at)` — User mute records for moderation
- `chat_typing`: `(user_id, username, updated_at)` — Ephemeral typing indicator tracking

### Announcements & Web Push (from `PLAN_ANNOUNCEMENTS.md`)
- `announcements`: `(id, title, message, url, pinned, created_at)` — System announcements with push broadcast
- `push_subscriptions`: `(id, user_id, endpoint, p256dh, auth, created_at)` — Browser push notification subscriptions
- `password_resets`: `(id, user_id, code, token, expires_at, created_at)` — Password reset requests with admin dispatch

### Feedback Box (from `PLAN_FEEDBACK.md`)
- `feedback`: `(id, user_id, nickname, client_id, body, created_at)` — Inbox for user & guest feedback with device nickname
- Index: `idx_feedback_created` on `feedback(created_at)`

---

## 3. Cloudflare R2 Avatar Storage (`animedy-avatars`)

User profile pictures are stored in Cloudflare R2 (S3-compatible, 0 egress fees, 10GB free).
- **R2 Bucket Name**: `animedy-avatars`
- **Pages Binding**: `env.AVATARS` (configured in `wrangler.toml`)
- **Direct Image URL**: `GET /api/avatar/[userId]`
- **Upload / Update**: `POST /api/user/avatar` (multipart/form-data with `file`)
- **Delete / Reset**: `DELETE /api/user/avatar`

### Using in Frontend:
```typescript
import { auth } from "$lib/stores/auth.svelte";

// Current user avatar:
auth.user?.avatar_url // string URL or null

// Upload new avatar from <input type="file">:
const avatarUrl = await auth.updateAvatar(file);

// Remove avatar:
await auth.removeAvatar();
```

---

## 3. How to Query the Database

### A. Terminal / Wrangler CLI
```bash
# Run ad-hoc query
npx wrangler d1 execute animedy-db --remote --command="SELECT name FROM sqlite_master WHERE type='table';" -y

# Re-run / update schema
npx wrangler d1 execute animedy-db --remote --file=src/animedy_v1/queries/d1_ddl.sql -y
```

### B. Inside Cloudflare Pages Functions / Workers
When bound as `env.DB`:
```typescript
// Query rows
const { results } = await env.DB.prepare(
  "SELECT * FROM liked_anime WHERE user_id = ?"
).bind(userId).all();

// Insert / Upsert
await env.DB.prepare(
  "INSERT INTO liked_anime (user_id, anime_id) VALUES (?, ?) ON CONFLICT DO NOTHING"
).bind(userId, animeId).run();
```

### C. Cloudflare REST API Endpoint
```http
POST https://api.cloudflare.com/client/v4/accounts/42cd6827b074b6fa8b7a040dd9962bcf/d1/database/e00b316c-2119-4b2e-85fc-65b431e8b40f/query
Authorization: Bearer <CLOUDFLARE_API_TOKEN>
Content-Type: application/json

{
  "sql": "SELECT * FROM users LIMIT 10;"
}
```

---

## 4. Next Tasks for UI & Sync
Refer to `PLAN_USER_ACCOUNTS.md` for remaining tasks:
- §1–2: Password & username strength validation schemas
- §5: Guest-to-cloud migration logic (`local` → `animedy-db`)
- §6: Auth UI (`SignUp.svelte`, `SignIn.svelte`, `AccountPrompt.svelte`, `stores/auth.svelte.ts`)
- §7: Multi-device store syncing (`likes`, `customLists`, `watchStatus`)
