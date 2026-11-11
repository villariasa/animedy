# Chat Message Reactions (Discord-style) — Setup

Signed-in users can react to any global chat message with **any emoji** —
not a fixed set. Clicking an emoji you already used removes it (toggle),
same as Discord. No Cloudflare R2 / object storage is involved — a reaction
is just a tiny text row in D1 (the emoji is stored as plain text, not an
image), so there's nothing to provision beyond the one DB migration below.

## What ships in code

- `src/animedy_v1/queries/d1_ddl.sql` (section 24) — new table
  `chat_message_reactions`: one row per `(message_id, user_id, emoji)`, so a
  user can stack several different emoji on the same message but can't
  double-react with the same one.
- `functions/api/chat/[messageId]/react.ts` — `POST /api/chat/<id>/react`
  (signed-in only). Body `{ "emoji": "🔥" }`. Toggles: inserts if missing,
  deletes if already present. Validates the input is actually an emoji
  (Unicode `Extended_Pictographic` + variation-selector/ZWJ combinators
  only) so this endpoint can't be used to smuggle arbitrary text.
- `functions/api/chat.ts` (`GET /api/chat`) — each message now carries a
  `reactions: [{ emoji, count, user_ids }]` array, aggregated from
  `chat_message_reactions`. `user_ids` (not a precomputed "did I react"
  flag) is returned so the response stays anonymous/user-agnostic and safe
  to keep CDN-caching the same way it already does (3s `s-maxage`) — the
  client checks `user_ids.includes(myId)` locally to decide whether to
  highlight a pill as "mine".
- `src/lib/stores/chat.svelte.ts` — `toggleReaction(messageId, emoji)`
  (optimistic; corrects on the next poll if it drifts from the server) and
  a `merge()` fix so reaction counts on already-seen messages actually
  update as new poll responses come in (previously `merge()` only appended
  brand-new messages and ignored field changes on known ones).
- `src/lib/components/GlobalChat.svelte` — reaction pills under each
  message (click to toggle), a hover-revealed "+ 😊" button opening a small
  picker (8 common emoji + a free-text "any emoji" field).

## One-time setup you need to run

Just the DB migration — apply the whole DDL file like every prior chat
migration:

```bash
cd src/ui_test
npx wrangler d1 execute animedy-db --remote --file=../animedy_v1/queries/d1_ddl.sql -y
```

Everything in that file is `CREATE TABLE/INDEX IF NOT EXISTS`, so re-running
it is always safe — the only exception is the two `ALTER TABLE` lines added
for GIF/image attachments (section 23), which error with `duplicate column
name` if you've already applied them once before. That's harmless; ignore
it.

Verify:

```bash
npx wrangler d1 execute animedy-db --remote --command="SELECT name FROM sqlite_master WHERE type='table' AND name='chat_message_reactions';" -y
```

Then deploy as usual:

```bash
cd src/ui_test
npm run build
npx wrangler pages deploy dist
```

No secrets, env vars, or R2 buckets needed for this feature.

## Limits / moderation notes

- Reacting requires sign-in (`requireAuth`), same as sending a message.
- No rate limit on reactions specifically — each one is a single-row
  insert/delete, far cheaper than a message send or an upload, and the
  `UNIQUE(message_id, user_id, emoji)` constraint already prevents a user
  from spamming duplicate rows for the same reaction.
- Reacting to a soft-deleted message (`chat_messages.deleted = 1`) is
  rejected with 404 — admins who delete a message don't need to also worry
  about stray reactions appearing on it afterward.
- There's no admin "remove a reaction" endpoint yet. If abuse becomes a
  problem (e.g. someone spamming many different emoji on one message),
  the simplest fix is deleting rows directly via
  `DELETE FROM chat_message_reactions WHERE message_id = ? AND user_id = ?`
  — ask if you want a dedicated admin endpoint for this instead.
