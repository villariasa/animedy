# Plan: Feedback Box (admin-only inbox)

Anyone — signed-in users **and guests** — can send feedback. Only admins can
read it. Guests are tagged with a randomly generated nickname (e.g.
`Guest-BraveFox42`) that sticks to their device, so you can tell repeat
feedback apart without accounts.

---

## 1. Database table (create in remote D1)

Also appended to `src/animedy_v1/queries/d1_ddl.sql` (statement 20) — apply
with the usual safe command:

```bash
cd src/ui_test
npx wrangler d1 execute animedy-db --remote --file=../animedy_v1/queries/d1_ddl.sql -y
```

```sql
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,                  -- NULL for guests
  nickname TEXT NOT NULL,           -- username, or Guest-XxxYyyNN for guests
  client_id TEXT NOT NULL,          -- anonymous device id (rate limiting / dedup)
  body TEXT NOT NULL,               -- max 1000 chars
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback (created_at);
```

## 2. Endpoints

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /api/feedback` | none (token optional) | Submit feedback. Signed-in → real username attached; guest → device nickname. Rate limit: 1 per 60s per device. |
| `GET /api/admin/feedback` | admin | List feedback, newest first (self-prunes after 90 days). |
| `DELETE /api/admin/feedback/[id]` | admin | Remove an entry. |

## 3. UI

- **"💬 Feedback" entry** in the desktop More menu and the mobile nav drawer →
  opens a small modal: textarea + send. Guests see the auto-nickname they'll
  post under.
- **Admin page**: "Feedback" section listing nickname (👤 for accounts,
  "Guest" tag for guests), message, time, and a delete button.
