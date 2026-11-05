import type { PagesFunction } from "../../_lib/types";
import { ok, fail, readJson } from "../../_lib/http";
import { requireAuth } from "../../_lib/auth";
import { upsertAnimeStmt, sanitizeMeta } from "../../_lib/data";
import { asInt } from "../../_lib/validate";

const STATUSES = new Set(["watching", "completed", "plan_to_watch", "dropped"]);

export const onRequestPut: PagesFunction<{ animeId: string }> = async (context) => {
  const auth = await requireAuth(context);
  if ("response" in auth) return auth.response;
  const animeId = asInt(context.params.animeId);
  if (!animeId) return fail("Invalid anime id", 422);

  const body = await readJson(context.request);
  const status = typeof body.status === "string" ? body.status : "";
  if (!STATUSES.has(status)) return fail("Invalid status", 422);

  const db = context.env.DB;
  await db.batch([
    upsertAnimeStmt(db, { anime_id: animeId, ...sanitizeMeta(body) }),
    db
      .prepare(
        `INSERT INTO watch_status (user_id, anime_id, status, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id, anime_id) DO UPDATE SET
           status = excluded.status, updated_at = CURRENT_TIMESTAMP`
      )
      .bind(auth.claims.user_id, animeId, status),
  ]);
  return ok({ anime_id: animeId, status }, "Status saved", 200);
};

export const onRequestDelete: PagesFunction<{ animeId: string }> = async (context) => {
  const auth = await requireAuth(context);
  if ("response" in auth) return auth.response;
  const animeId = asInt(context.params.animeId);
  if (!animeId) return fail("Invalid anime id", 422);

  await context.env.DB.prepare(`DELETE FROM watch_status WHERE user_id = ? AND anime_id = ?`)
    .bind(auth.claims.user_id, animeId)
    .run();
  return ok({ anime_id: animeId }, "Status cleared", 200);
};
