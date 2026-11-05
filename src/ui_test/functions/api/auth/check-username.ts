import type { PagesFunction } from "../_lib/types";
import { ok, fail } from "../_lib/http";
import { validUsername } from "../_lib/validate";

export const onRequestGet: PagesFunction = async (context) => {
  const username = new URL(context.request.url).searchParams.get("username") ?? "";
  if (!validUsername(username)) {
    return fail("Username must be 3-20 characters (letters, numbers, underscore)", 422);
  }
  const existing = await context.env.DB.prepare(`SELECT id FROM users WHERE username = ?`)
    .bind(username)
    .first();
  return ok({ username, available: !existing }, "Availability checked", 200);
};
