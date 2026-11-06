import type { PagesFunction, UserRow } from "../_lib/types";
import { ok, fail, readJson } from "../_lib/http";
import { verifyPassword, signToken, toProfile } from "../_lib/auth";
import { consumeAuthPass } from "../_lib/verifypass";

export const onRequestPost: PagesFunction = async (context) => {
  const { env } = context;
  if (!env.JWT_SECRET) return fail("JWT_SECRET is not configured", 500);

  const body = await readJson(context.request);

  // Full-page verification gate: one single-use pass per attempt (see
  // PLAN_VERIFY_GATE.md). 428 tells the client to run the #/verify flow.
  if (!(await consumeAuthPass(env, body.verify_pass))) {
    return fail("Verification required", 428);
  }
  const identifier = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!identifier || !password) return fail("Invalid request body", 422);

  // Accept either email or username in the same field.
  const user = await env.DB.prepare(
    `SELECT * FROM users WHERE email = ? OR username = ? LIMIT 1`
  )
    .bind(identifier, identifier)
    .first<UserRow>();
  if (!user) return fail("Invalid credentials", 401);

  const matches = await verifyPassword(password, user.password_hash);
  if (!matches) return fail("Invalid credentials", 401);

  const token = await signToken(
    { user_id: user.id, username: user.username, role: user.role },
    env.JWT_SECRET
  );
  return ok({ user: toProfile(user), token }, "Login successful", 200);
};
