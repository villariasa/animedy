import type { PagesFunction } from "../_lib/types";
import { ok, fail, readJson } from "../_lib/http";
import { requireAuth } from "../_lib/auth";

/** Register this device for push notifications. Any signed-in account can
 * subscribe (announcements go to everyone); reset-request alerts are still
 * filtered to admin-role subscriptions when sending. */
export const onRequestPost: PagesFunction = async (context) => {
  const auth = await requireAuth(context);
  if ("response" in auth) return auth.response;

  const body = await readJson(context.request);
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  const keys = (body.keys ?? {}) as Record<string, unknown>;
  const p256dh = typeof keys.p256dh === "string" ? keys.p256dh : "";
  const authKey = typeof keys.auth === "string" ? keys.auth : "";
  if (!endpoint.startsWith("https://") || !p256dh || !authKey) {
    return fail("Invalid push subscription", 422);
  }

  await context.env.DB.prepare(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth_key)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (endpoint) DO UPDATE SET
       user_id = excluded.user_id,
       p256dh = excluded.p256dh,
       auth_key = excluded.auth_key`
  )
    .bind(auth.claims.user_id, endpoint, p256dh, authKey)
    .run();

  return ok({ subscribed: true }, "Push subscription saved", 200);
};

export const onRequestDelete: PagesFunction = async (context) => {
  const auth = await requireAuth(context);
  if ("response" in auth) return auth.response;

  const body = await readJson(context.request);
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  if (!endpoint) return fail("Missing endpoint", 422);

  await context.env.DB.prepare(
    `DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?`
  )
    .bind(endpoint, auth.claims.user_id)
    .run();
  return ok({ subscribed: false }, "Push subscription removed", 200);
};
