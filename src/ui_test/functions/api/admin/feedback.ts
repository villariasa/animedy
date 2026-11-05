import type { PagesFunction } from "../_lib/types";
import { ok } from "../_lib/http";
import { requireAdmin } from "../_lib/auth";

/** Feedback inbox — admin only. Entries older than 90 days self-prune. */
export const onRequestGet: PagesFunction = async (context) => {
  const auth = await requireAdmin(context);
  if ("response" in auth) return auth.response;
  const db = context.env.DB;

  context.waitUntil(
    db.prepare(`DELETE FROM feedback WHERE created_at < datetime('now', '-90 days')`).run()
  );

  const rows = await db
    .prepare(
      `SELECT id, user_id, nickname, body, created_at
       FROM feedback ORDER BY id DESC LIMIT 200`
    )
    .all();

  return ok({ feedback: rows.results }, "Feedback retrieved", 200);
};
