import type { PagesFunction } from "../_lib/types";
import { ok, fail } from "../_lib/http";
import { requireAuth } from "../_lib/auth";

// Mirrors src/lib/api/account.ts CHAT_ATTACHMENT_* constants — keep in sync.
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8MB (GIFs run bigger than static images)
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

// Per-user upload rate limit — separate from the 1 msg / 2s text rate limit
// because attachments are heavier (R2 writes, bandwidth on read).
const UPLOAD_WINDOW_MS = 10_000;
const lastUploadAtByUser = new Map<number, number>();

/** Upload a chat image/GIF attachment. Signed-in only. Returns the URL to
 * send along with (or instead of) a text body via POST /api/chat. */
export const onRequestPost: PagesFunction = async (context) => {
  const auth = await requireAuth(context);
  if ("response" in auth) return auth.response;
  const userId = auth.claims.user_id;

  const lastAt = lastUploadAtByUser.get(userId) ?? 0;
  if (Date.now() - lastAt < UPLOAD_WINDOW_MS) {
    return fail("You're uploading too fast — wait a few seconds", 429);
  }

  const r2 = context.env.CHAT_MEDIA;
  if (!r2) {
    return fail("Chat media storage (R2) is not configured", 503);
  }

  const contentTypeHeader = context.request.headers.get("content-type") || "";
  if (!contentTypeHeader.includes("multipart/form-data")) {
    return fail("Send multipart/form-data with a 'file' field", 415);
  }

  const formData = await context.request.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return fail("No image/GIF file provided in form data ('file')", 400);
  }
  if (file.size === 0) {
    return fail("Empty file received", 400);
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return fail("File exceeds the 8MB limit", 413);
  }
  const mimeType = file.type || "";
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return fail("Only JPEG, PNG, WebP and GIF files are allowed", 415);
  }

  const buffer = await file.arrayBuffer();
  const ext = EXT_BY_MIME[mimeType];
  const objectKey = `chat/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  await r2.put(objectKey, buffer, { httpMetadata: { contentType: mimeType } });
  lastUploadAtByUser.set(userId, Date.now());

  return ok(
    { url: `/api/chat/media/${objectKey}`, type: mimeType },
    "Uploaded",
    201
  );
};
