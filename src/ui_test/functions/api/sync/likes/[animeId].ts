import type { PagesFunction } from "../../_lib/types";
import { ok, fail, readJson } from "../../_lib/http";
import { requireAuth } from "../../_lib/auth";
import { upsertAnimeStmt, sanitizeMeta, type AnimeMeta } from "../../_lib/data";
import { asInt } from "../../_lib/validate";

export const onRequestPut: PagesFunction<{ animeId: string }> = async (context) => {
  const auth = await requireAuth(context);
  if ("response" in auth) return auth.response;
  const animeId = asInt(context.params.animeId);
  if (!animeId) return fail("Invalid anime id", 422);

  const body = await readJson(context.request);
  const meta: AnimeMeta = { anime_id: animeId, ...sanitizeMeta(body) };
  const db = context.env.DB;
  await db.batch([
    upsertAnimeStmt(db, meta),
    db
      .prepare(
        `INSERT INTO liked_anime (user_id, anime_id, liked_at)
         VALUES (?, ?, COALESCE(?, CURRENT_TIMESTAMP))
         ON CONFLICT (user_id, anime_id) DO NOTHING`
      )
      .bind(auth.claims.user_id, animeId, typeof body.liked_at === "string" ? body.liked_at : null),
  ]);
  return ok({ anime_id: animeId }, "Liked", 200);
};

export const onRequestDelete: PagesFunction<{ animeId: string }> = async (context) => {
  const auth = await requireAuth(context);
  if ("response" in auth) return auth.response;
  const animeId = asInt(context.params.animeId);
  if (!animeId) return fail("Invalid anime id", 422);

  await context.env.DB.prepare(`DELETE FROM liked_anime WHERE user_id = ? AND anime_id = ?`)
    .bind(auth.claims.user_id, animeId)
    .run();
  return ok({ anime_id: animeId }, "Unliked", 200);
};
