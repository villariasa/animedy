import type { PagesFunction } from "../_lib/types";
import { ok } from "../_lib/http";
import { requireAdmin } from "../_lib/auth";

/** Live sessions (guests + accounts) for the admin dashboard.
 * online = heartbeat within the last 3 minutes; watching = online with an
 * anime attached. Sessions older than 7 days are pruned opportunistically. */
export const onRequestGet: PagesFunction = async (context) => {
  const auth = await requireAdmin(context);
  if ("response" in auth) return auth.response;
  const db = context.env.DB;

  context.waitUntil(
    db.prepare(`DELETE FROM user_activity WHERE updated_at < datetime('now', '-7 days')`).run()
  );

  const sessions = await db
    .prepare(
      `SELECT client_id, user_id, username, page, anime_id, episode_number,
              position_seconds, title, cover_image, updated_at,
              (updated_at >= datetime('now', '-3 minutes')) AS online
       FROM user_activity
       ORDER BY updated_at DESC
       LIMIT 200`
    )
    .all();

  return ok({ sessions: sessions.results, now: new Date().toISOString() }, "Activity retrieved", 200);
};
