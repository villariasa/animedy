# Plan: Admin Push Announcements

Admin composes an announcement on the admin page → it's pushed as a real OS
notification to **every device that enabled notifications** (any signed-in
user, not just admins), even when the PWA is closed.

---

## 1. Database table (create this in remote D1)

Also appended to `src/animedy_v1/queries/d1_ddl.sql` (statement 18) — apply
with the usual safe command:

```bash
cd src/ui_test
npx wrangler d1 execute animedy-db --remote --file=../animedy_v1/queries/d1_ddl.sql -y
```

```sql
CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL,
  title TEXT NOT NULL,              -- max 100 chars
  body TEXT NOT NULL,               -- max 500 chars
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users (id) ON DELETE CASCADE
);
```

(`push_subscriptions` from the previous step is reused — no new columns.)

## 2. How it works

- Pushes are payload-less (VAPID wake-up only). When the service worker wakes,
  it fetches `GET /api/announcements/latest`: if there's an announcement from
  the last 5 minutes it shows **its title/body** (click → opens the app);
  otherwise it falls back to the generic admin reset-request alert
  (click → admin dashboard).
- `POST /api/push/subscribe` is now open to **all signed-in users** (was
  admin-only) so regular users can opt in to announcements. Admin-only reset
  alerts still go only to admin-role subscriptions.
- Admin page gets a **"Send announcement"** composer (title + message).
- Settings → Account gets an **"Enable notifications"** button for users.

## 3. Endpoints

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /api/admin/announce` | admin | Save announcement + push to all subscribed devices |
| `GET /api/announcements/latest` | none | Latest announcement (used by the service worker + in-app) |
| `POST/DELETE /api/push/subscribe` | user | Register/remove this device (now any account) |
