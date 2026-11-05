import type { PagesFunction } from "../../../_lib/types";
import { ok, fail, readJson } from "../../../_lib/http";
import { requireAdmin } from "../../../_lib/auth";
import { asInt } from "../../../_lib/validate";

/** Mute a user. Body: { reason?, hours? } — omit hours for permanent. */
export const onRequestPut: PagesFunction<{ userId: string }> = async (context) => {
  const auth = await requireAdmin(context);
  if ("response" in auth) return auth.response;
  const userId = asInt(context.params.userId);
  if (!userId) return fail("Invalid user id", 422);
  if (userId === auth.claims.user_id) return fail("You can't mute yourself", 422);

  const body = await readJson(context.request);
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 255) : null;
  const hours =
    typeof body.hours === "number" && Number.isFinite(body.hours) && body.hours > 0
      ? Math.min(24 * 365, Math.round(body.hours))
      : null;

  await context.env.DB.prepare(
    `INSERT INTO chat_mutes (user_id, reason, muted_by, muted_until)
     VALUES (?, ?, ?, CASE WHEN ? IS NULL THEN NULL ELSE datetime('now', '+' || ? || ' hours') END)
     ON CONFLICT (user_id) DO UPDATE SET
       reason = excluded.reason,
       muted_by = excluded.muted_by,
       muted_until = excluded.muted_until,
       created_at = CURRENT_TIMESTAMP`
  )
    .bind(userId, reason, auth.claims.user_id, hours, hours)
    .run();

  return ok({ user_id: userId, hours }, hours ? `User muted for ${hours}h` : "User muted permanently", 200);
};

export const onRequestDelete: PagesFunction<{ userId: string }> = async (context) => {
  const auth = await requireAdmin(context);
  if ("response" in auth) return auth.response;
  const userId = asInt(context.params.userId);
  if (!userId) return fail("Invalid user id", 422);

  await context.env.DB.prepare(`DELETE FROM chat_mutes WHERE user_id = ?`).bind(userId).run();
  return ok({ user_id: userId }, "User unmuted", 200);
};
