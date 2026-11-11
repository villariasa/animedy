# Chat GIF Search (Tenor) — Setup

The chat composer has a **GIF** button next to the image-upload button. It
opens a search panel (type a query or leave it blank for trending GIFs),
and clicking a result sends it straight into chat — no file upload involved,
the message just points at Tenor's own CDN URL. This is a *different*
mechanism from the image/GIF **upload** feature in
`CHAT_MEDIA_R2_SETUP.md` — that one is for files from the user's own device
and goes through R2; this one is for picking an existing GIF from an online
library and needs **no R2 bucket at all**.

## What ships in code

- `functions/api/chat/gif-search.ts` — `GET /api/chat/gif-search?q=<query>`
  (signed-in only). Proxies to the [Tenor API v2](https://tenor.com/gifapi)
  (`/search` when `q` is given, `/featured` — i.e. trending — when it's
  empty), using a server-side API key that's never exposed to the client.
  Rate-limited to 1 request/second per user. Returns a slim shape:
  `{ results: [{ id, url, preview_url, width, height }] }`.
- `functions/api/chat.ts` — the attachment URL check on `POST /api/chat`
  now also accepts URLs on Tenor's own media CDN
  (`https://media.tenor.com/...` or `https://c.tenor.com/...`), in addition
  to the user's own uploaded-file URLs. Anything else is still rejected, so
  this can't be used to attach an arbitrary external image.
- `src/lib/api/account.ts` — `apiChatGifSearch(query)`.
- `src/lib/stores/chat.svelte.ts` — `sendGif(url, caption)`.
- `src/lib/components/GlobalChat.svelte` — the **GIF** button, a debounced
  (400ms) search panel with a 3-column results grid, and a small "GIFs via
  Tenor" attribution line (required by Tenor's API terms).

## One-time setup you need to run

### 1. Get a Tenor API key (free)

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) (Tenor's API moved under Google after their acquisition).
2. Create/select a project, enable the **Tenor API**, and create an API key under *APIs & Services → Credentials*.
3. (Optional but recommended) restrict the key to the Tenor API only.

### 2. Set it as a Cloudflare Pages secret

Same place the existing `JWT_SECRET` / `TURNSTILE_SECRET` secrets live —
**not** `wrangler.toml` (that file is checked into git; secrets never go
there):

- **Local dev**: add to `src/ui_test/.dev.vars` (gitignored):
  ```
  TENOR_API_KEY=your-key-here
  ```
- **Production**: Cloudflare dashboard → your Pages project → *Settings →
  Environment variables* → add `TENOR_API_KEY` as a secret for the
  Production environment (and Preview, if you want GIF search to work on
  preview deploys too).

No database migration and no R2 bucket are needed for this feature —
skip straight to deploying once the key is set.

### 3. Deploy

```bash
cd src/ui_test
npm run build
npx wrangler pages deploy dist
```

## Behavior when not configured

If `TENOR_API_KEY` isn't set, `GET /api/chat/gif-search` returns
`503 "GIF search is not configured"` and the picker shows that as an error
in the panel — the rest of chat (text, uploaded images/GIFs, reactions)
keeps working normally either way.

## Limits enforced

| Limit | Value | Where |
|---|---|---|
| Who can search | signed-in users only | `requireAuth` in `gif-search.ts` — the API key is metered, so this must not be exposed to anonymous callers |
| Search rate | 1 request / second per user | in-memory map in `gif-search.ts` (best-effort; resets if the Worker isolate recycles) |
| Results per search | 24 | `RESULT_LIMIT` in `gif-search.ts` |
| Content filter | `medium` (Tenor's built-in moderate filter) | `contentfilter=medium` query param — raise/lower if needed |
| Attachment URL accepted on send | must be the user's own R2 upload *or* a `media.tenor.com` / `c.tenor.com` URL | `functions/api/chat.ts` `POST` handler |
