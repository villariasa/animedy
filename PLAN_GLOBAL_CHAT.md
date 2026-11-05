# Plan: Global Live Chat

One global chat room for the whole site. Signed-in users only can send;
everyone can read. Runs on the existing Cloudflare Pages Functions + D1 stack —
no new infrastructure. Reads are edge-cached a few seconds so the chat is
effectively free to run regardless of how many people have it open.

---

## 1. Database (create this first)

Two tables, SQLite/D1 syntax. Also appended to
`src/animedy_v1/queries/d1_ddl.sql` (statements 14–15), so you can apply it
with the same command as before — safe to re-run, everything is `IF NOT EXISTS`:

```bash
cd src/ui_test
npx wrangler d1 execute animedy-db --remote --file=../animedy_v1/queries/d1_ddl.sql -y
```

### 1.1 chat_messages

```sql
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  username TEXT NOT NULL,              -- denormalized for cheap reads (no JOIN)
  body TEXT NOT NULL,                  -- max 500 chars, enforced server-side
  deleted INTEGER NOT NULL DEFAULT 0,  -- soft delete by admin (1 = hidden)
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages (created_at);
```

Notes:
- `username` is denormalized on purpose: the read endpoint is the hot path and
  must stay a single indexed SELECT with no JOIN.
- Soft delete (`deleted` flag) instead of hard DELETE so admin removals leave
  an audit trail and the `since`-cursor pagination on clients never skips ids.
- Old messages can be pruned opportunistically (e.g. keep last 1,000) the same
  way `user_activity` prunes itself.

### 1.2 chat_mutes (moderation)

```sql
CREATE TABLE IF NOT EXISTS chat_mutes (
  user_id INTEGER PRIMARY KEY,
  reason TEXT,
  muted_by INTEGER NOT NULL,           -- admin user id
  muted_until TEXT,                    -- NULL = permanent
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
```

A row here blocks `POST /api/chat` for that user (permanently, or until
`muted_until`). Admin can mute/unmute from the dashboard.

### Verify after applying

```bash
npx wrangler d1 execute animedy-db --remote --command="SELECT name FROM sqlite_master WHERE type='table' AND name IN ('chat_messages','chat_mutes');" -y
```

---

## 2. API endpoints (Pages Functions, reuse existing `_lib`)

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /api/chat?since=<id>` | none | Last 50 non-deleted messages (or newer than `since`). Response carries `Cache-Control: s-maxage=3` → CDN cache hits never invoke the function or touch D1. |
| `POST /api/chat` | user | Send. Validations: 1–500 chars after trim; not muted; rate limit 1 msg / 2 s per user (checked against the user's own last `created_at`). |
| `DELETE /api/admin/chat/[messageId]` | admin | Soft-delete a message. |
| `PUT /api/admin/chat/mute/[userId]` | admin | Mute (body: optional `reason`, `hours`; omit `hours` = permanent). |
| `DELETE /api/admin/chat/mute/[userId]` | admin | Unmute. |

Same response envelope (`{success, http_code, message, data}`) and `_lib`
helpers (`requireAuth`, `requireAdmin`, `ok`/`fail`) as the account API.

---

## 3. Frontend

- `GlobalChat.svelte` — collapsible chat drawer (desktop: right side; mobile:
  full-height sheet), mounted in `App.svelte`. Polls every 4–5 s **only while
  open**, pauses when the tab is hidden, stops when closed.
- Signed-out users see the message feed + a "Sign in to chat" button linking
  to `#/signin` (ties into the account funnel).
- `chat.svelte.ts` store — messages, open/closed state, send(), poll loop,
  optimistic append of your own message.
- Admin extras rendered inline when `auth.isAdmin`: delete button per message,
  mute button per author (drives the `/api/admin/chat/*` endpoints).

---

## 4. Build order

1. **You**: apply the DDL (step 1 command) — tell me when done.
2. Me: endpoints (`chat.ts`, admin moderation functions).
3. Me: chat store + `GlobalChat.svelte` + App wiring + admin controls.
4. Me: typecheck/build + local wrangler smoke test (register → send → read →
   rate-limit → mute → delete).
5. You: deploy (`npx wrangler pages deploy dist` from `src/ui_test`).
