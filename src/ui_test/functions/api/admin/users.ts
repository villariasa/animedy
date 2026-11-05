import type { PagesFunction } from "../_lib/types";
import { ok } from "../_lib/http";
import { requireAdmin } from "../_lib/auth";

/** Registered accounts with per-user stats for the admin dashboard. */
export const onRequestGet: PagesFunction = async (context) => {
  const auth = await requireAdmin(context);
  if ("response" in auth) return auth.response;

  const users = await context.env.DB.prepare(
    `SELECT u.id, u.username, u.email, u.role, u.created_at,
            (SELECT COUNT(*) FROM liked_anime la WHERE la.user_id = u.id) AS likes_count,
            (SELECT COUNT(*) FROM custom_lists cl WHERE cl.user_id = u.id) AS lists_count,
            (SELECT COUNT(*) FROM watch_status ws WHERE ws.user_id = u.id AND ws.status = 'watching') AS watching_count,
            (SELECT COUNT(*) FROM watch_status ws WHERE ws.user_id = u.id AND ws.status = 'completed') AS completed_count,
            (SELECT COUNT(*) FROM watch_status ws WHERE ws.user_id = u.id AND ws.status = 'plan_to_watch') AS plan_count,
            (SELECT COUNT(*) FROM watch_status ws WHERE ws.user_id = u.id AND ws.status = 'dropped') AS dropped_count,
            (SELECT MAX(ua.updated_at) FROM user_activity ua WHERE ua.user_id = u.id) AS last_active_at,
            (SELECT cm.muted_until FROM chat_mutes cm WHERE cm.user_id = u.id AND (cm.muted_until IS NULL OR cm.muted_until > datetime('now'))) AS muted_until,
            (SELECT cm.reason FROM chat_mutes cm WHERE cm.user_id = u.id) AS mute_reason
     FROM users u
     ORDER BY last_active_at DESC NULLS LAST, u.created_at DESC
     LIMIT 500`
  ).all();

  return ok({ users: users.results }, "Users retrieved", 200);
};
