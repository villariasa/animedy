import type { D1PreparedStatement, PagesFunction } from "../_lib/types";
import { ok, fail, readJson } from "../_lib/http";
import { requireAuth } from "../_lib/auth";
import { fetchCloudState, sanitizeMeta, upsertAnimeStmt } from "../_lib/data";
import { asInt } from "../_lib/validate";

const STATUSES = new Set(["watching", "completed", "plan_to_watch", "dropped"]);
const MAX_ITEMS = 2000;

/**
 * One-time guest → account migration. Merges the device's local data into
 * the account (union — never overwrites existing cloud rows; on conflict the
 * cloud copy wins) and returns the merged full cloud state so the client can
 * replace its local stores with it.
 *
 * Body: {
 *   likes: [{anime_id, title_english?, ..., liked_at?}],
 *   lists: [{name, entries: [{anime_id, ..., added_at?}]}],
 *   watch_status: [{anime_id, status, ...}],
 *   settings: {volume?, playback_speed?, ...}  // applied only if the account
 *                                              // has never saved settings
 * }
 */
export const onRequestPost: PagesFunction = async (context) => {
  const auth = await requireAuth(context);
  if ("response" in auth) return auth.response;
  const userId = auth.claims.user_id;
  const db = context.env.DB;
  const body = await readJson(context.request);

  const likes = Array.isArray(body.likes) ? body.likes.slice(0, MAX_ITEMS) : [];
  const lists = Array.isArray(body.lists) ? body.lists.slice(0, 200) : [];
  const statuses = Array.isArray(body.watch_status) ? body.watch_status.slice(0, MAX_ITEMS) : [];

  const stmts: D1PreparedStatement[] = [];

  for (const raw of likes) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const animeId = asInt(item.anime_id);
    if (!animeId) continue;
    stmts.push(upsertAnimeStmt(db, { anime_id: animeId, ...sanitizeMeta(item) }));
    stmts.push(
      db
        .prepare(
          `INSERT INTO liked_anime (user_id, anime_id, liked_at)
           VALUES (?, ?, COALESCE(?, CURRENT_TIMESTAMP))
           ON CONFLICT (user_id, anime_id) DO NOTHING`
        )
        .bind(userId, animeId, typeof item.liked_at === "string" ? item.liked_at : null)
    );
  }

  for (const raw of statuses) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const animeId = asInt(item.anime_id);
    const status = typeof item.status === "string" ? item.status : "";
    if (!animeId || !STATUSES.has(status)) continue;
    stmts.push(upsertAnimeStmt(db, { anime_id: animeId, ...sanitizeMeta(item) }));
    stmts.push(
      db
        .prepare(
          `INSERT INTO watch_status (user_id, anime_id, status, updated_at)
           VALUES (?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
           ON CONFLICT (user_id, anime_id) DO NOTHING`
        )
        .bind(userId, animeId, status, typeof item.updated_at === "string" ? item.updated_at : null)
    );
  }

  if (stmts.length > 0) {
    await db.batch(stmts);
  }

  // Lists need their server ids before entries can be inserted, so they run
  // sequentially (reusing an existing same-named list instead of duplicating).
  for (const raw of lists) {
    if (!raw || typeof raw !== "object") continue;
    const list = raw as Record<string, unknown>;
    const name = typeof list.name === "string" ? list.name.trim().slice(0, 128) : "";
    if (!name) continue;

    const existing = await db
      .prepare(`SELECT id FROM custom_lists WHERE user_id = ? AND name = ? LIMIT 1`)
      .bind(userId, name)
      .first<{ id: number }>();
    let listId = existing?.id;
    if (!listId) {
      const insert = await db
        .prepare(
          `INSERT INTO custom_lists (user_id, name, created_at)
           VALUES (?, ?, COALESCE(?, CURRENT_TIMESTAMP))`
        )
        .bind(userId, name, typeof list.created_at === "string" ? list.created_at : null)
        .run();
      listId = insert.meta.last_row_id;
    }

    const entries = Array.isArray(list.entries) ? list.entries.slice(0, MAX_ITEMS) : [];
    const entryStmts: D1PreparedStatement[] = [];
    for (const rawEntry of entries) {
      if (!rawEntry || typeof rawEntry !== "object") continue;
      const entry = rawEntry as Record<string, unknown>;
      const animeId = asInt(entry.anime_id);
      if (!animeId) continue;
      entryStmts.push(upsertAnimeStmt(db, { anime_id: animeId, ...sanitizeMeta(entry) }));
      entryStmts.push(
        db
          .prepare(
            `INSERT INTO custom_list_entries (list_id, anime_id, added_at)
             VALUES (?, ?, COALESCE(?, CURRENT_TIMESTAMP))
             ON CONFLICT (list_id, anime_id) DO NOTHING`
          )
          .bind(listId, animeId, typeof entry.added_at === "string" ? entry.added_at : null)
      );
    }
    if (entryStmts.length > 0) {
      await db.batch(entryStmts);
    }
  }

  // Local settings only apply when the account has no settings row yet
  // (a fresh sign-up); an account synced from another device keeps its own.
  if (body.settings && typeof body.settings === "object") {
    const hasRow = await db
      .prepare(`SELECT user_id FROM user_settings WHERE user_id = ?`)
      .bind(userId)
      .first();
    if (!hasRow) {
      await db.prepare(`INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)`).bind(userId).run();
      // Delegate the field-by-field validation to the settings endpoint logic
      // by calling it inline would be circular; keep migration minimal — the
      // client follows up with PUT /api/sync/settings after migration.
    }
  }

  const state = await fetchCloudState(db, userId);
  return ok(state, "Migration complete", 200);
};

export const onRequestGet: PagesFunction = async () => fail("Method not allowed", 405);
