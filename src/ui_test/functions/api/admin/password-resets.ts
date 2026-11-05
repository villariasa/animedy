import type { PagesFunction } from "../_lib/types";
import { ok } from "../_lib/http";
import { requireAdmin } from "../_lib/auth";

/** All reset requests for the admin dashboard, newest first. Stale pending
 * requests (>7 days) are pruned opportunistically. */
export const onRequestGet: PagesFunction = async (context) => {
  const auth = await requireAdmin(context);
  if ("response" in auth) return auth.response;
  const db = context.env.DB;

  context.waitUntil(
    db
      .prepare(
        `DELETE FROM password_resets
         WHERE (status = 'pending' AND requested_at < datetime('now', '-7 days'))
            OR (status != 'pending' AND resolved_at < datetime('now', '-7 days'))`
      )
      .run()
  );

  const rows = await db
    .prepare(
      `SELECT pr.id, pr.user_id, u.username, u.email, pr.status, pr.requested_at, pr.resolved_at
       FROM password_resets pr
       JOIN users u ON u.id = pr.user_id
       ORDER BY pr.requested_at DESC
       LIMIT 100`
    )
    .all();

  return ok({ requests: rows.results }, "Reset requests retrieved", 200);
};
