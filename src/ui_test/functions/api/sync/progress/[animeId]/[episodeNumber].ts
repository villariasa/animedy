import type { PagesFunction } from "../../../_lib/types";
import { ok, fail, readJson } from "../../../_lib/http";
import { requireAuth } from "../../../_lib/auth";
import { upsertAnimeStmt, sanitizeMeta } from "../../../_lib/data";
import { asInt } from "../../../_lib/validate";

type Params = { animeId: string; episodeNumber: string };

/** Live single-episode progress save from the player (throttled client-side).
 * Same last-write-wins rule as the bulk endpoint. */
export const onRequestPut: PagesFunction<Params> = async (context) => {
  const auth = await requireAuth(context);
  if ("response" in auth) return auth.response;
  const animeId = asInt(context.params.animeId);
  const episodeNumber = asInt(context.params.episodeNumber);
  if (!animeId || !episodeNumber) return fail("Invalid id", 422);

  const body = await readJson(context.request);
  const position = typeof body.position_seconds === "number" ? Math.max(0, Math.round(body.position_seconds)) : 0;
  const duration = typeof body.duration_seconds === "number" ? Math.max(0, Math.round(body.duration_seconds)) : 0;
  const completed = body.completed === true || body.completed === 1 ? 1 : 0;
  const episodeTitle = typeof body.episode_title === "string" ? body.episode_title.slice(0, 512) : null;
  const lastWatched = typeof body.last_watched_at === "string" ? body.last_watched_at : null;

  const db = context.env.DB;
  await db.batch([
    upsertAnimeStmt(db, { anime_id: animeId, ...sanitizeMeta(body) }),
    db
      .prepare(
        `INSERT INTO watch_history
           (user_id, anime_id, episode_number, position_seconds, duration_seconds, completed, episode_title, last_watched_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(strftime('%Y-%m-%d %H:%M:%S', ?), strftime('%Y-%m-%d %H:%M:%S', 'now')))
         ON CONFLICT (user_id, anime_id, episode_number) DO UPDATE SET
           position_seconds = excluded.position_seconds,
           duration_seconds = excluded.duration_seconds,
           completed = MAX(watch_history.completed, excluded.completed),
           episode_title = COALESCE(excluded.episode_title, watch_history.episode_title),
           last_watched_at = excluded.last_watched_at
         WHERE excluded.last_watched_at >= watch_history.last_watched_at`
      )
      .bind(auth.claims.user_id, animeId, episodeNumber, position, duration, completed, episodeTitle, lastWatched),
  ]);

  return ok({ anime_id: animeId, episode_number: episodeNumber }, "Progress saved", 200);
};
