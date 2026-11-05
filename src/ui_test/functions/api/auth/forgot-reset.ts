import type { PagesFunction, UserRow } from "../_lib/types";
import { ok, fail, readJson } from "../_lib/http";
import { hashPassword, sha256Hex } from "../_lib/auth";
import { passwordProblems } from "../_lib/validate";

/**
 * Final step of the admin-approved reset: the requesting device (proven by
 * client_secret) sets a new password once the request is approved and not
 * older than 24h. The request row is consumed on success.
 */
export const onRequestPost: PagesFunction = async (context) => {
  const { env } = context;
  const body = await readJson(context.request);

  const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
  const clientSecret = typeof body.client_secret === "string" ? body.client_secret : "";
  const newPassword = typeof body.new_password === "string" ? body.new_password : "";
  if (!identifier || !clientSecret) return fail("Invalid request", 422);

  const passwordProblem = passwordProblems(newPassword);
  if (passwordProblem) return fail(passwordProblem, 422);

  const secretHash = await sha256Hex(clientSecret);
  const match = await env.DB.prepare(
    `SELECT pr.id AS reset_id, u.id AS user_id
     FROM password_resets pr
     JOIN users u ON u.id = pr.user_id
     WHERE (u.email = ? OR u.username = ?)
       AND pr.secret_hash = ?
       AND pr.status = 'approved'
       AND pr.resolved_at >= datetime('now', '-24 hours')
     LIMIT 1`
  )
    .bind(identifier, identifier, secretHash)
    .first<{ reset_id: number; user_id: number }>();

  if (!match) {
    return fail("No approved reset request for this device — ask the admin to approve it first", 403);
  }

  const passwordHash = await hashPassword(newPassword);
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(passwordHash, match.user_id),
    env.DB.prepare(`DELETE FROM password_resets WHERE id = ?`).bind(match.reset_id),
  ]);

  const user = await env.DB.prepare(`SELECT username FROM users WHERE id = ?`)
    .bind(match.user_id)
    .first<Pick<UserRow, "username">>();

  return ok(
    { username: user?.username ?? identifier },
    "Password changed — you can sign in now",
    200
  );
};
