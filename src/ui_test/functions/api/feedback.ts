import type { Env, PagesFunction } from "./_lib/types";
import { ok, fail, readJson } from "./_lib/http";
import { verifyToken } from "./_lib/auth";
import { asOptionalString } from "./_lib/validate";
import { notifyAdmins } from "./_lib/push";

const MAX_BODY_CHARS = 1000;

/** Submit feedback — open to everyone. A valid Bearer token attaches the
 * account; guests post under their device nickname. 1 per minute per device. */
export const onRequestPost: PagesFunction = async (context) => {
  const env: Env = context.env;
  const body = await readJson(context.request);

  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) return fail("Feedback is empty", 422);
  if (text.length > MAX_BODY_CHARS) return fail(`Feedback is too long (max ${MAX_BODY_CHARS} characters)`, 422);

  const clientId = typeof body.client_id === "string" ? body.client_id.slice(0, 64) : "";
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(clientId)) return fail("Invalid request", 422);

  let userId: number | null = null;
  let nickname = asOptionalString(body.nickname, 40) ?? "Guest";
  const header = context.request.headers.get("Authorization");
  if (header?.startsWith("Bearer ") && env.JWT_SECRET) {
    const claims = await verifyToken(header.slice("Bearer ".length).trim(), env.JWT_SECRET);
    if (claims) {
      userId = claims.user_id;
      nickname = claims.username;
    }
  }

  const recent = await env.DB.prepare(
    `SELECT id FROM feedback WHERE client_id = ? AND created_at >= datetime('now', '-60 seconds') LIMIT 1`
  )
    .bind(clientId)
    .first();
  if (recent) return fail("Please wait a minute between feedback messages", 429);

  await env.DB.prepare(
    `INSERT INTO feedback (user_id, nickname, client_id, body) VALUES (?, ?, ?, ?)`
  )
    .bind(userId, nickname, clientId, text)
    .run();

  // Wake every admin device (push works even with the PWA closed).
  context.waitUntil(notifyAdmins(env, env.DB));

  return ok({ sent: true }, "Thanks for the feedback!", 201);
};
