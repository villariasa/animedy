import type { PagesFunction } from "../_lib/types";
import { ok, fail, readJson } from "../_lib/http";
import { requireAuth } from "../_lib/auth";

export const onRequestPost: PagesFunction = async (context) => {
  const auth = await requireAuth(context);
  if ("response" in auth) return auth.response;

  const body = await readJson(context.request);
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 128) : "";
  if (!name) return fail("List name is required", 422);

  const insert = await context.env.DB.prepare(
    `INSERT INTO custom_lists (user_id, name) VALUES (?, ?)`
  )
    .bind(auth.claims.user_id, name)
    .run();

  return ok({ id: insert.meta.last_row_id, name }, "List created", 201);
};
