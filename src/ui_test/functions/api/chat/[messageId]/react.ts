import type { PagesFunction } from "../../_lib/types";
import { ok, fail, readJson } from "../../_lib/http";
import { requireAuth } from "../../_lib/auth";
import { asInt } from "../../_lib/validate";

// A single emoji, or a short ZWJ sequence (e.g. "👨‍👩‍👧" or "❤️"): only
// pictographic chars plus the variation-selector (U+FE0F) and zero-width-
// joiner (U+200D) combinators are allowed — rejects plain text so
// "reactions" can't be used to smuggle arbitrary messages.
const EMOJI_RE = /^(?:\p{Extended_Pictographic}[\u{FE0F}\u{200D}]*)+$/u;
const MAX_EMOJI_CHARS = 16;

/** Toggle a reaction — signed-in only. Discord-style: any emoji, one row
 * per (message, user, emoji), so clicking the same emoji again removes it. */
export const onRequestPost: PagesFunction<{ messageId: string }> = async (context) => {
  const auth = await requireAuth(context);
  if ("response" in auth) return auth.response;

  const messageId = asInt(context.params.messageId);
  if (!messageId) return fail("Invalid message id", 400);

  const body = await readJson(context.request);
  const emoji = typeof body.emoji === "string" ? body.emoji.trim() : "";
  if (!emoji || emoji.length > MAX_EMOJI_CHARS || !EMOJI_RE.test(emoji)) {
    return fail("Invalid emoji", 422);
  }

  const db = context.env.DB;
  const userId = auth.claims.user_id;

  const message = await db
    .prepare(`SELECT id FROM chat_messages WHERE id = ? AND deleted = 0`)
    .bind(messageId)
    .first<{ id: number }>();
  if (!message) return fail("Message not found", 404);

  const existing = await db
    .prepare(`SELECT id FROM chat_message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?`)
    .bind(messageId, userId, emoji)
    .first<{ id: number }>();

  if (existing) {
    await db.prepare(`DELETE FROM chat_message_reactions WHERE id = ?`).bind(existing.id).run();
    return ok({ reacted: false, emoji }, "Reaction removed", 200);
  }

  await db
    .prepare(`INSERT INTO chat_message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)`)
    .bind(messageId, userId, emoji)
    .run();
  return ok({ reacted: true, emoji }, "Reaction added", 201);
};
