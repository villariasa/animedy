import type { PagesFunction } from "../_lib/types";
import { ok, fail } from "../_lib/http";
import { requireAuth } from "../_lib/auth";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const onRequestPost: PagesFunction = async (context) => {
  const auth = await requireAuth(context);
  if ("response" in auth) return auth.response;

  const r2 = context.env.AVATARS;
  if (!r2) {
    return fail("Avatar storage (R2) is not configured", 503);
  }

  const contentTypeHeader = context.request.headers.get("content-type") || "";
  let fileBuffer: ArrayBuffer | null = null;
  let mimeType = "image/jpeg";

  if (contentTypeHeader.includes("multipart/form-data")) {
    const formData = await context.request.formData();
    const file = formData.get("file") || formData.get("avatar");
    if (!file || !(file instanceof File)) {
      return fail("No image file provided in form data ('file' or 'avatar')", 400);
    }
    if (file.size > MAX_AVATAR_BYTES) {
      return fail("Image size exceeds 2MB limit", 413);
    }
    mimeType = file.type || "image/jpeg";
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return fail("Invalid image type. Allowed: JPEG, PNG, WebP, GIF", 415);
    }
    fileBuffer = await file.arrayBuffer();
  } else if (ALLOWED_MIME_TYPES.has(contentTypeHeader.split(";")[0].trim())) {
    mimeType = contentTypeHeader.split(";")[0].trim();
    fileBuffer = await context.request.arrayBuffer();
    if (fileBuffer.byteLength > MAX_AVATAR_BYTES) {
      return fail("Image size exceeds 2MB limit", 413);
    }
  } else {
    return fail("Please send multipart/form-data with an image or direct image content-type", 415);
  }

  if (!fileBuffer || fileBuffer.byteLength === 0) {
    return fail("Empty file received", 400);
  }

  const userId = auth.claims.user_id;
  const objectKey = `avatars/${userId}`;

  // Upload to R2
  await r2.put(objectKey, fileBuffer, {
    httpMetadata: {
      contentType: mimeType,
    },
  });

  const avatarUrl = `/api/avatar/${userId}?v=${Date.now()}`;

  // Update users and chat_messages in D1
  const db = context.env.DB;
  await db.batch([
    db
      .prepare(`UPDATE users SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(avatarUrl, userId),
    db
      .prepare(`UPDATE chat_messages SET avatar_url = ? WHERE user_id = ?`)
      .bind(avatarUrl, userId),
  ]);

  return ok({ avatar_url: avatarUrl }, "Profile picture updated successfully", 200);
};

export const onRequestDelete: PagesFunction = async (context) => {
  const auth = await requireAuth(context);
  if ("response" in auth) return auth.response;

  const userId = auth.claims.user_id;
  const r2 = context.env.AVATARS;
  if (r2) {
    await r2.delete(`avatars/${userId}`);
  }

  const db = context.env.DB;
  await db.batch([
    db
      .prepare(`UPDATE users SET avatar_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(userId),
    db
      .prepare(`UPDATE chat_messages SET avatar_url = NULL WHERE user_id = ?`)
      .bind(userId),
  ]);

  return ok({ avatar_url: null }, "Profile picture removed", 200);
};
