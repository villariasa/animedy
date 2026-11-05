// Shared D1 data helpers: anime metadata upsert (sync tables FK to anime.id)
// and the full cloud-state payload returned to the client after login or
// migration.

import type { D1Database } from "./types";

/** Anime metadata sent alongside like/list/status writes so the cloud copy
 * can render titles and covers on any device. anime.id === AniList id for
 * all rows written through sync (explicit PK insert). */
export interface AnimeMeta {
  anime_id: number;
  title_english?: string | null;
  title_romaji?: string | null;
  cover_image?: string | null;
  format?: string | null;
  season_year?: number | null;
}

export function sanitizeMeta(body: Record<string, unknown>): Omit<AnimeMeta, "anime_id"> {
  return {
    title_english: typeof body.title_english === "string" ? body.title_english : null,
    title_romaji: typeof body.title_romaji === "string" ? body.title_romaji : null,
    cover_image: typeof body.cover_image === "string" ? body.cover_image : null,
    format: typeof body.format === "string" ? body.format : null,
    season_year: typeof body.season_year === "number" ? body.season_year : null,
  };
}

export function upsertAnimeStmt(db: D1Database, meta: AnimeMeta) {
  return db
    .prepare(
      `INSERT INTO anime (id, anilist_id, title_english, title_romaji, cover_image, format, season_year, cached_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         title_english = COALESCE(excluded.title_english, anime.title_english),
         title_romaji = COALESCE(excluded.title_romaji, anime.title_romaji),
         cover_image = COALESCE(excluded.cover_image, anime.cover_image),
         format = COALESCE(excluded.format, anime.format),
         season_year = COALESCE(excluded.season_year, anime.season_year)`
    )
    .bind(
      meta.anime_id,
      meta.anime_id,
      meta.title_english ?? null,
      meta.title_romaji ?? null,
      meta.cover_image ?? null,
      meta.format ?? null,
      meta.season_year ?? null
    );
}

export interface CloudLike {
  anime_id: number;
  title_english: string | null;
  title_romaji: string | null;
  cover_image: string | null;
  format: string | null;
  season_year: number | null;
  liked_at: string;
}

export interface CloudListEntry {
  list_id: number;
  anime_id: number;
  title_english: string | null;
  title_romaji: string | null;
  cover_image: string | null;
  format: string | null;
  season_year: number | null;
  added_at: string;
}

export interface CloudList {
  id: number;
  name: string;
  created_at: string;
}

export interface CloudWatchStatus {
  anime_id: number;
  status: string;
  title_english: string | null;
  title_romaji: string | null;
  cover_image: string | null;
  format: string | null;
  season_year: number | null;
  updated_at: string;
}

export interface CloudState {
  likes: CloudLike[];
  lists: CloudList[];
  list_entries: CloudListEntry[];
  watch_status: CloudWatchStatus[];
  settings: Record<string, unknown> | null;
}

const ANIME_COLS =
  "a.title_english, a.title_romaji, a.cover_image, a.format, a.season_year";

export async function fetchCloudState(db: D1Database, userId: number): Promise<CloudState> {
  const [likes, lists, entries, statuses, settings] = await db.batch([
    db
      .prepare(
        `SELECT l.anime_id, ${ANIME_COLS}, l.liked_at
         FROM liked_anime l JOIN anime a ON a.id = l.anime_id
         WHERE l.user_id = ? ORDER BY l.liked_at DESC`
      )
      .bind(userId),
    db
      .prepare(`SELECT id, name, created_at FROM custom_lists WHERE user_id = ? ORDER BY created_at`)
      .bind(userId),
    db
      .prepare(
        `SELECT e.list_id, e.anime_id, ${ANIME_COLS}, e.added_at
         FROM custom_list_entries e
         JOIN custom_lists cl ON cl.id = e.list_id
         JOIN anime a ON a.id = e.anime_id
         WHERE cl.user_id = ? ORDER BY e.added_at DESC`
      )
      .bind(userId),
    db
      .prepare(
        `SELECT w.anime_id, w.status, ${ANIME_COLS}, w.updated_at
         FROM watch_status w JOIN anime a ON a.id = w.anime_id
         WHERE w.user_id = ? ORDER BY w.updated_at DESC`
      )
      .bind(userId),
    db.prepare(`SELECT * FROM user_settings WHERE user_id = ?`).bind(userId),
  ]);

  return {
    likes: likes.results as CloudState["likes"],
    lists: lists.results as CloudState["lists"],
    list_entries: entries.results as CloudState["list_entries"],
    watch_status: statuses.results as CloudState["watch_status"],
    settings: (settings.results[0] as Record<string, unknown> | undefined) ?? null,
  };
}
