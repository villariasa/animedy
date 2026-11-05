import type { PagesFunction } from "../../_lib/types";
import { ok, fail } from "../../_lib/http";
import { requireAdmin } from "../../_lib/auth";
import { asInt } from "../../_lib/validate";

/** Soft-delete a chat message (audit trail stays, feed hides it). */
export const onRequestDelete: PagesFunction<{ messageId: string }> = async (context) => {
  const auth = await requireAdmin(context);
  if ("response" in auth) return auth.response;
  const messageId = asInt(context.params.messageId);
  if (!messageId) return fail("Invalid message id", 422);

  const result = await context.env.DB.prepare(
    `UPDATE chat_messages SET deleted = 1 WHERE id = ? AND deleted = 0`
  )
    .bind(messageId)
    .run();
  if (result.meta.changes === 0) return fail("Message not found", 404);
  return ok({ id: messageId }, "Message deleted", 200);
};
