# Chat GIF Search (GIPHY) — Setup

The chat composer has a **GIF** button next to the image-upload button. It
opens a search panel (type a query or leave it blank for trending GIFs),
and clicking a result sends it straight into chat — no file upload involved,
the message just points at GIPHY's CDN URL. This is a *different* mechanism
from the image/GIF **upload** feature in `CHAT_MEDIA_R2_SETUP.md` — that one
is for files from the user's own device and goes through R2; this one is for
picking an existing GIF from an online library and needs **no R2 bucket at all**.

## What ships in code

- `functions/api/chat/gif-search.ts` — `GET /api/chat/gif-search?q=<query>`
  (signed-in only). Proxies to the GIPHY API (`/search` when `q` is given,
  `/trending` when it's empty), using a server-side API key that's never exposed
  to the client. Rate-limited to 1 request/second per user. Returns a slim shape:
  `{ results: [{ id, url, preview_url, width, height }] }`.
- `functions/api/chat.ts` — the attachment URL check on `POST /api/chat`
  accepts URLs on GIPHY's media CDN (`https://media*.giphy.com/...` or `https://i.giphy.com/...`),
  alongside self-uploaded R2 files and Tenor URLs.
- `src/lib/api/account.ts` — `apiChatGifSearch(query)`.
- `src/lib/stores/chat.svelte.ts` — `sendGif(url, caption)`.
- `src/lib/components/GlobalChat.svelte` — the **GIF** button, a debounced
  (400ms) search panel with a 3-column results grid, and "Powered by GIPHY" attribution.

## Secret configuration

The `GIPHY_API_KEY` secret is configured in:
- **Local dev**: `src/ui_test/.dev.vars`:
  ```
  GIPHY_API_KEY=yTLTnHmNGVL4g22VQeFFWY9c5xX4fJay
  ```
- **Production**: Cloudflare Pages Secret `GIPHY_API_KEY` via `wrangler pages secret put`.

## Limits enforced

| Limit | Value | Where |
|---|---|---|
| Who can search | signed-in users only | `requireAuth` in `gif-search.ts` |
| Search rate | 1 request / second per user | in-memory map in `gif-search.ts` |
| Results per search | 24 | `RESULT_LIMIT` in `gif-search.ts` |
| Rating filter | `g` (general audience) | `rating=g` query param |
| Attachment URL accepted on send | must be user's R2 upload or `*.giphy.com` / `*.tenor.com` | `functions/api/chat.ts` `POST` handler |
