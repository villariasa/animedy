import type { PagesFunction } from "../../_lib/types";
import { ok, fail, readJson } from "../../_lib/http";
import { requireAuth } from "../../_lib/auth";
import { asInt } from "../../_lib/validate";

export const onRequestPatch: PagesFunction<{ listId: string }> = async (context) => {
  const auth = await requireAuth(context);
  if ("response" in auth) return auth.response;
  const listId = asInt(context.params.listId);
  if (!listId) return fail("Invalid list id", 422);

  const body = await readJson(context.request);
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 128) : "";
  if (!name) return fail("List name is required", 422);

  const result = await context.env.DB.prepare(
    `UPDATE custom_lists SET name = ? WHERE id = ? AND user_id = ?`
  )
    .bind(name, listId, auth.claims.user_id)
    .run();
  if (result.meta.changes === 0) return fail("List not found", 404);
  return ok({ id: listId, name }, "List renamed", 200);
};

export const onRequestDelete: PagesFunction<{ listId: string }> = async (context) => {
  const auth = await requireAuth(context);
  if ("response" in auth) return auth.response;
  const listId = asInt(context.params.listId);
  if (!listId) return fail("Invalid list id", 422);

  const result = await context.env.DB.prepare(
    `DELETE FROM custom_lists WHERE id = ? AND user_id = ?`
  )
    .bind(listId, auth.claims.user_id)
    .run();
  if (result.meta.changes === 0) return fail("List not found", 404);
  return ok({ id: listId }, "List deleted", 200);
};
