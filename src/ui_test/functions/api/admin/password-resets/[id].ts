import type { PagesFunction } from "../../_lib/types";
import { ok, fail, readJson } from "../../_lib/http";
import { requireAdmin } from "../../_lib/auth";
import { asInt } from "../../_lib/validate";

/** Approve or deny a pending password-reset request. Body: {action}. */
export const onRequestPut: PagesFunction<{ id: string }> = async (context) => {
  const auth = await requireAdmin(context);
  if ("response" in auth) return auth.response;
  const id = asInt(context.params.id);
  if (!id) return fail("Invalid request id", 422);

  const body = await readJson(context.request);
  const action = body.action === "approve" ? "approved" : body.action === "deny" ? "denied" : null;
  if (!action) return fail("Action must be 'approve' or 'deny'", 422);

  const result = await context.env.DB.prepare(
    `UPDATE password_resets
     SET status = ?, resolved_at = CURRENT_TIMESTAMP
     WHERE id = ? AND status = 'pending'`
  )
    .bind(action, id)
    .run();
  if (result.meta.changes === 0) return fail("Request not found or already resolved", 404);

  return ok({ id, status: action }, action === "approved" ? "Request approved — the user has 24h to set a new password" : "Request denied", 200);
};
