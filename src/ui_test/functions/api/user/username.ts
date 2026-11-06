import type { PagesFunction, UserRow } from "../_lib/types";
import { ok, fail, readJson } from "../_lib/http";
import { requireAuth, verifyPassword, signToken, toProfile } from "../_lib/auth";
import { validUsername } from "../_lib/validate";

/** Change username. Requires the current password (an unattended session
 * must not be able to silently rebrand the account). Returns a fresh JWT —
 * the username is baked into the token claims. */
export const onRequestPut: PagesFunction = async (context) => {
  const auth = await requireAuth(context);
  if ("response" in auth) return auth.response;
  const { env } = context;
  const db = env.DB;

  const body = await readJson(context.request);
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!validUsername(username)) {
    return fail("Username must be 3-20 characters (letters, numbers, underscore)", 422);
  }

  const user = await db.prepare(`SELECT * FROM users WHERE id = ?`)
    .bind(auth.claims.user_id)
    .first<UserRow>();
  if (!user) return fail("User not found", 404);
  if (!password || !(await verifyPassword(password, user.password_hash))) {
    return fail("Current password is incorrect", 403);
  }
  if (username === user.username) return fail("That's already your username", 422);

  const taken = await db.prepare(`SELECT id FROM users WHERE username = ? AND id != ?`)
    .bind(username, user.id)
    .first();
  if (taken) return fail("Username is already taken", 409);

  // Update the canonical row plus every denormalized copy.
  await db.batch([
    db.prepare(`UPDATE users SET username = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(username, user.id),
    db.prepare(`UPDATE chat_messages SET username = ? WHERE user_id = ?`).bind(username, user.id),
    db.prepare(`UPDATE user_activity SET username = ? WHERE user_id = ?`).bind(username, user.id),
    db.prepare(`UPDATE chat_typing SET username = ? WHERE user_id = ?`).bind(username, user.id),
    db.prepare(`UPDATE feedback SET nickname = ? WHERE user_id = ?`).bind(username, user.id),
  ]);

  const updated: UserRow = { ...user, username };
  const token = await signToken(
    { user_id: user.id, username, role: user.role },
    env.JWT_SECRET
  );
  return ok({ user: toProfile(updated), token }, "Username changed", 200);
};
