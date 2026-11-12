# Chat Media (Images/GIFs) — Cloudflare R2 Setup

Global chat now supports sending an image or GIF alongside (or instead of) a
text message. Storage reuses the same Cloudflare R2 pattern as profile
avatars, just in a separate bucket so attachment traffic/limits don't share
quota with avatars.

## What ships in code (nothing to configure there)

- `src/ui_test/wrangler.toml` — new binding:
  ```toml
  [[r2_buckets]]
  binding = "CHAT_MEDIA"
  bucket_name = "animedy-chat-media"
  ```
- `functions/api/chat/upload.ts` — `POST /api/chat/upload` (signed-in only).
  Accepts `multipart/form-data` with a `file` field, validates it, uploads to
  R2, returns `{ url, type }`.
- `functions/api/chat/media/[[key]].ts` — `GET /api/chat/media/<key>` streams
  the object back out of R2 (public read, same as `/api/avatar/[userId]`),
  cached hard (`immutable`) since filenames are random per upload.
- `functions/api/chat.ts` — `POST /api/chat` now also accepts optional
  `attachment_url` / `attachment_type` and stores them on the message row.
- `src/animedy_v1/queries/d1_ddl.sql` — adds `attachment_url` /
  `attachment_type` columns to `chat_messages` (section 23).

## One-time setup you need to run

### 1. Create the R2 bucket

```bash
cd src/ui_test
npx wrangler r2 bucket create animedy-chat-media
```

### 2. Apply the DB migration (new columns on `chat_messages`)

```bash
cd src/ui_test
npx wrangler d1 execute animedy-db --remote --file=../animedy_v1/queries/d1_ddl.sql -y
```

This re-runs the whole DDL file (same command as every prior migration in
this project — everything else is `IF NOT EXISTS` and no-ops). The two new
`ALTER TABLE chat_messages ADD COLUMN ...` statements will error with
`duplicate column name` **only if you've already applied them before** —
that error is harmless, ignore it.

Verify:

```bash
npx wrangler d1 execute animedy-db --remote --command="SELECT attachment_url, attachment_type FROM chat_messages LIMIT 1;" -y
```

### 3. Deploy

```bash
cd src/ui_test
npm run build
npx wrangler pages deploy dist
```

No new secrets/env vars are needed — R2 bucket bindings work the same way
the `AVATARS` binding already does (configured in `wrangler.toml`, available
as `context.env.CHAT_MEDIA` in Pages Functions automatically).

## Limits enforced (client + server, kept in sync)

| Limit | Value | Where |
|---|---|---|
| Max file size | 8 MB | `functions/api/chat/upload.ts` (server), `src/lib/api/account.ts` `MAX_CHAT_ATTACHMENT_BYTES` (client, fails fast before upload) |
| Allowed types | JPEG, PNG, WebP, GIF | same two files, `ALLOWED_MIME_TYPES` / `CHAT_ATTACHMENT_MIME_TYPES` |
| Upload rate | 1 upload / 10 s per user | in-memory map in `upload.ts` (best-effort; resets if the Worker isolate recycles — the per-message 1-msg/2s D1 rate limit on `POST /api/chat` still applies on top of this) |
| Who can upload | signed-in users only | `requireAuth` in `upload.ts`, same as sending text |

To change any limit, edit both the server constant and the client constant
listed above — they're intentionally duplicated (client-side check is just a
fast-fail UX nicety; the server is the real enforcement).

## How it works end-to-end

1. User clicks the photo icon in the chat composer → picks a file.
2. Client validates type/size locally, `POST /api/chat/upload` (multipart) →
   object lands in the `animedy-chat-media` R2 bucket under
   `chat/<userId>/<timestamp>-<random>.<ext>`.
3. Server returns `{ url: "/api/chat/media/chat/<userId>/<file>", type }`.
4. Client immediately `POST /api/chat` with that `attachment_url` +
   `attachment_type` (plus whatever text, if any, was in the composer as a
   caption) — this becomes a normal chat message row.
5. Everyone polling `GET /api/chat` sees the message with its attachment and
   renders the image/GIF inline; clicking it opens a full-size lightbox.

The upload endpoint re-derives the object key server-side and the send
endpoint checks `attachment_url` starts with `/api/chat/media/chat/<the
sender's own userId>/` — so a user can only attach something they just
uploaded themselves, never an arbitrary URL or someone else's file.


i hope to plan another next time 
