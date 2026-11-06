import type { PagesFunction, UserRow } from "../_lib/types";
import { ok, fail, readJson } from "../_lib/http";
import { requireAuth, verifyPassword, hashPassword } from "../_lib/auth";
import { passwordProblems } from "../_lib/validate";

/** Change password — requires the current one, enforces the same strength
 * rules as sign-up. Existing JWTs stay valid (they don't embed the hash). */
export const onRequestPut: PagesFunction = async (context) => {
  const auth = await requireAuth(context);
  if ("response" in auth) return auth.response;
  const db = context.env.DB;

  const body = await readJson(context.request);
  const current = typeof body.current_password === "string" ? body.current_password : "";
  const next = typeof body.new_password === "string" ? body.new_password : "";

  const problem = passwordProblems(next);
  if (problem) return fail(problem, 422);

  const user = await db.prepare(`SELECT * FROM users WHERE id = ?`)
    .bind(auth.claims.user_id)
    .first<UserRow>();
  if (!user) return fail("User not found", 404);
  if (!current || !(await verifyPassword(current, user.password_hash))) {
    return fail("Current password is incorrect", 403);
  }
  if (current === next) return fail("New password must be different from the current one", 422);

  const passwordHash = await hashPassword(next);
  await db
    .prepare(`UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(passwordHash, user.id)
    .run();

  return ok({ changed: true }, "Password changed", 200);
};
