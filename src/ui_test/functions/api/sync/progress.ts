import type { D1PreparedStatement, PagesFunction } from "../_lib/types";
import { ok, fail, readJson } from "../_lib/http";
import { requireAuth } from "../_lib/auth";
import { upsertAnimeStmt, sanitizeMeta } from "../_lib/data";
import { asInt } from "../_lib/validate";

const MAX_ITEMS = 1000;

/** Last-write-wins upsert: a device only overwrites the cloud row when its
 * last_watched_at is newer. Timestamps are normalized via strftime so client
 * ISO strings and SQLite CURRENT_TIMESTAMP compare consistently. */
function upsertProgressStmt(
  db: { prepare(q: string): D1PreparedStatement },
  userId: number,
  item: Record<string, unknown>,
  animeId: number,
  episodeNumber: number
): D1PreparedStatement {
  const position = typeof item.position_seconds === "number" ? Math.max(0, Math.round(item.position_seconds)) : 0;
  const duration = typeof item.duration_seconds === "number" ? Math.max(0, Math.round(item.duration_seconds)) : 0;
  const completed = item.completed === true || item.completed === 1 ? 1 : 0;
  const episodeTitle = typeof item.episode_title === "string" ? item.episode_title.slice(0, 512) : null;
  const lastWatched = typeof item.last_watched_at === "string" ? item.last_watched_at : null;

  return db
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
    .bind(userId, animeId, episodeNumber, position, duration, completed, episodeTitle, lastWatched);
}

/** Full progress history for this account (hydrates a new device). */
export const onRequestGet: PagesFunction = async (context) => {
  const auth = await requireAuth(context);
  if ("response" in auth) return auth.response;

  const rows = await context.env.DB.prepare(
    `SELECT w.anime_id, w.episode_number, w.position_seconds, w.duration_seconds,
            w.completed, w.episode_title, w.last_watched_at,
            a.title_english, a.title_romaji, a.cover_image
     FROM watch_history w JOIN anime a ON a.id = w.anime_id
     WHERE w.user_id = ?
     ORDER BY w.last_watched_at DESC
     LIMIT ?`
  )
    .bind(auth.claims.user_id, MAX_ITEMS)
    .all();

  return ok({ progress: rows.results }, "Progress retrieved", 200);
};

/** Bulk upsert (login merge). Body: { items: [{anime_id, episode_number, ...meta}] } */
export const onRequestPost: PagesFunction = async (context) => {
  const auth = await requireAuth(context);
  if ("response" in auth) return auth.response;
  const db = context.env.DB;

  const body = await readJson(context.request);
  const items = Array.isArray(body.items) ? body.items.slice(0, MAX_ITEMS) : [];
  if (items.length === 0) return fail("No items", 422);

  const stmts: D1PreparedStatement[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const animeId = asInt(item.anime_id);
    const episodeNumber = asInt(item.episode_number);
    if (!animeId || !episodeNumber) continue;
    stmts.push(upsertAnimeStmt(db, { anime_id: animeId, ...sanitizeMeta(item) }));
    stmts.push(upsertProgressStmt(db, auth.claims.user_id, item, animeId, episodeNumber));
  }
  if (stmts.length > 0) {
    await db.batch(stmts);
  }
  return ok({ saved: stmts.length / 2 }, "Progress merged", 200);
};
