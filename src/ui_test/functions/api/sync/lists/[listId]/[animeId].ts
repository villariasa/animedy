import type { PagesFunction } from "../../../_lib/types";
import { ok, fail, readJson } from "../../../_lib/http";
import { requireAuth } from "../../../_lib/auth";
import { upsertAnimeStmt, sanitizeMeta } from "../../../_lib/data";
import { asInt } from "../../../_lib/validate";

type Params = { listId: string; animeId: string };

async function ownsList(
  context: Parameters<PagesFunction<Params>>[0],
  listId: number,
  userId: number
): Promise<boolean> {
  const row = await context.env.DB.prepare(
    `SELECT id FROM custom_lists WHERE id = ? AND user_id = ?`
  )
    .bind(listId, userId)
    .first();
  return row !== null;
}

export const onRequestPut: PagesFunction<Params> = async (context) => {
  const auth = await requireAuth(context);
  if ("response" in auth) return auth.response;
  const listId = asInt(context.params.listId);
  const animeId = asInt(context.params.animeId);
  if (!listId || !animeId) return fail("Invalid id", 422);
  if (!(await ownsList(context, listId, auth.claims.user_id))) return fail("List not found", 404);

  const body = await readJson(context.request);
  const db = context.env.DB;
  await db.batch([
    upsertAnimeStmt(db, { anime_id: animeId, ...sanitizeMeta(body) }),
    db
      .prepare(
        `INSERT INTO custom_list_entries (list_id, anime_id, added_at)
         VALUES (?, ?, COALESCE(?, CURRENT_TIMESTAMP))
         ON CONFLICT (list_id, anime_id) DO NOTHING`
      )
      .bind(listId, animeId, typeof body.added_at === "string" ? body.added_at : null),
  ]);
  return ok({ list_id: listId, anime_id: animeId }, "Entry added", 200);
};

export const onRequestDelete: PagesFunction<Params> = async (context) => {
  const auth = await requireAuth(context);
  if ("response" in auth) return auth.response;
  const listId = asInt(context.params.listId);
  const animeId = asInt(context.params.animeId);
  if (!listId || !animeId) return fail("Invalid id", 422);
  if (!(await ownsList(context, listId, auth.claims.user_id))) return fail("List not found", 404);

  await context.env.DB.prepare(
    `DELETE FROM custom_list_entries WHERE list_id = ? AND anime_id = ?`
  )
    .bind(listId, animeId)
    .run();
  return ok({ list_id: listId, anime_id: animeId }, "Entry removed", 200);
};
