import type { Env, PagesFunction } from "../_lib/types";
import { ok } from "../_lib/http";
import { requireAdmin } from "../_lib/auth";
import { notifyAdmins, notifyEveryone } from "../_lib/push";

interface PushEnv extends Env {
  VAPID_PRIVATE_JWK?: string;
  VAPID_PUBLIC_KEY?: string;
}

/** Push diagnostics — shows at a glance why pushes might not deliver. */
export const onRequestGet: PagesFunction = async (context) => {
  const auth = await requireAdmin(context);
  if ("response" in auth) return auth.response;
  const env = context.env as PushEnv;

  const counts = await env.DB.prepare(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN u.role = 'admin' THEN 1 ELSE 0 END) AS admins
     FROM push_subscriptions ps JOIN users u ON u.id = ps.user_id`
  ).first<{ total: number; admins: number }>();

  return ok(
    {
      vapid_configured: Boolean(env.VAPID_PRIVATE_JWK && env.VAPID_PUBLIC_KEY),
      subscriptions_total: counts?.total ?? 0,
      subscriptions_admin: counts?.admins ?? 0,
    },
    "Push status",
    200
  );
};

/** Fire a real test push. Body: {target: "admins" | "everyone"} (default admins). */
export const onRequestPost: PagesFunction = async (context) => {
  const auth = await requireAdmin(context);
  if ("response" in auth) return auth.response;

  const body = (await context.request.json().catch(() => ({}))) as { target?: string };
  if (body.target === "everyone") {
    await notifyEveryone(context.env, context.env.DB);
  } else {
    await notifyAdmins(context.env, context.env.DB);
  }
  return ok({ fired: true }, "Test push fired — check your devices", 200);
};
