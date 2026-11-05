import type { PagesFunction, UserRow } from "../_lib/types";
import { ok, fail } from "../_lib/http";
import { requireAuth, toProfile } from "../_lib/auth";

export const onRequestGet: PagesFunction = async (context) => {
  const auth = await requireAuth(context);
  if ("response" in auth) return auth.response;

  const user = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?`)
    .bind(auth.claims.user_id)
    .first<UserRow>();
  if (!user) return fail("User not found", 404);

  return ok({ user: toProfile(user) }, "Profile retrieved", 200);
};
