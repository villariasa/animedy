import type { PagesFunction } from "../../_lib/types";
import { ok, fail } from "../../_lib/http";
import { requireAdmin } from "../../_lib/auth";
import { asInt } from "../../_lib/validate";

export const onRequestDelete: PagesFunction<{ id: string }> = async (context) => {
  const auth = await requireAdmin(context);
  if ("response" in auth) return auth.response;
  const id = asInt(context.params.id);
  if (!id) return fail("Invalid feedback id", 422);

  const result = await context.env.DB.prepare(`DELETE FROM feedback WHERE id = ?`).bind(id).run();
  if (result.meta.changes === 0) return fail("Feedback not found", 404);
  return ok({ id }, "Feedback deleted", 200);
};
