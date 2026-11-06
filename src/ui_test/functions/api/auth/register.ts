import type { PagesFunction, UserRow } from "../_lib/types";
import { ok, fail, readJson } from "../_lib/http";
import { hashPassword, signToken, toProfile } from "../_lib/auth";
import { validEmail, validUsername, passwordProblems } from "../_lib/validate";
import { consumeAuthPass } from "../_lib/verifypass";

export const onRequestPost: PagesFunction = async (context) => {
  const { env } = context;
  if (!env.JWT_SECRET) return fail("JWT_SECRET is not configured", 500);

  const body = await readJson(context.request);
  const { email, username, password } = body;

  // Full-page verification gate: one single-use pass per attempt (see
  // PLAN_VERIFY_GATE.md). 428 tells the client to run the #/verify flow.
  if (!(await consumeAuthPass(env, body.verify_pass))) {
    return fail("Verification required", 428);
  }

  if (!validEmail(email)) return fail("Invalid email address", 422);
  if (!validUsername(username)) {
    return fail("Username must be 3-20 characters (letters, numbers, underscore)", 422);
  }
  const passwordProblem = passwordProblems(password);
  if (passwordProblem) return fail(passwordProblem, 422);

  const existingEmail = await env.DB.prepare(`SELECT id FROM users WHERE email = ?`)
    .bind(email)
    .first();
  if (existingEmail) return fail("Email already registered", 409);

  const existingUsername = await env.DB.prepare(`SELECT id FROM users WHERE username = ?`)
    .bind(username)
    .first();
  if (existingUsername) return fail("Username already taken", 409);

  const passwordHash = await hashPassword(password as string);
  const insert = await env.DB.prepare(
    `INSERT INTO users (email, username, password_hash, role) VALUES (?, ?, ?, 'user')`
  )
    .bind(email, username, passwordHash)
    .run();
  const userId = insert.meta.last_row_id;

  await env.DB.prepare(`INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)`)
    .bind(userId)
    .run();

  const user = await env.DB.prepare(`SELECT * FROM users WHERE id = ?`)
    .bind(userId)
    .first<UserRow>();
  if (!user) return fail("Failed to create user", 500);

  const token = await signToken(
    { user_id: user.id, username: user.username, role: user.role },
    env.JWT_SECRET
  );
  return ok({ user: toProfile(user), token }, "User registered", 201);
};
