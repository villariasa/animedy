import type { PagesFunction } from "../../_lib/types";

/** Serves a chat attachment out of R2. Public read (same as avatars) — the
 * object key already embeds the uploader's user id, there's nothing to gate
 * on a per-request basis, and chat messages themselves are publicly readable. */
export const onRequestGet: PagesFunction<{ key: string[] }> = async (context) => {
  const segments = context.params.key;
  if (!segments || segments.length === 0) {
    return new Response("Not found", { status: 404 });
  }

  const r2 = context.env.CHAT_MEDIA;
  if (!r2) {
    return new Response("Chat media storage not configured", { status: 503 });
  }

  // segments already include the "chat" prefix (the upload endpoint returns
  // the URL as /api/chat/media/<objectKey>, and objectKey starts with "chat/").
  const objectKey = segments.join("/");
  const object = await r2.get(objectKey);
  if (!object) {
    return new Response("Attachment not found", { status: 404 });
  }

  const contentType = object.httpMetadata?.contentType || "application/octet-stream";
  return new Response(object.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      // Attachments are immutable (random filename per upload) — cache hard.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
