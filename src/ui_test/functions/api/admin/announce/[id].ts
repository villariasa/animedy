import type { PagesFunction } from "../../_lib/types";
import { ok, fail } from "../../_lib/http";
import { requireAdmin } from "../../_lib/auth";
import { asInt } from "../../_lib/validate";

/** Delete an announcement — it disappears from the public feed and the
 * in-app notification bell stops surfacing it to new viewers. */
export const onRequestDelete: PagesFunction<{ id: string }> = async (context) => {
  const auth = await requireAdmin(context);
  if ("response" in auth) return auth.response;
  const id = asInt(context.params.id);
  if (!id) return fail("Invalid announcement id", 422);

  const result = await context.env.DB.prepare(`DELETE FROM announcements WHERE id = ?`)
    .bind(id)
    .run();
  if (result.meta.changes === 0) return fail("Announcement not found", 404);
  return ok({ id }, "Announcement deleted", 200);
};
