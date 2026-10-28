import type { Context } from "hono";
import { query } from "../../lib/dbconn.js";
import { logError } from "../../lib/errorlogger.js";
import { ok, fail } from "../lib/response.js";
import { getClaims } from "../utils/auth.js";
import { continueWatchingListSchema } from "../schemas/progress.js";
import { SELECT_CONTINUE_WATCHING_LIST } from "../queries/progress.js";
import type { ContinueWatchingItem, ContinueWatchingListResponse } from "../interfaces/api.js";

interface ContinueWatchingRow {
  franchise_key: string;
  anime_id: number;
  title_romaji: string | null;
  title_english: string | null;
  season_label: string | null;
  episode_id: number;
  episode_number: number;
  position_seconds: number | null;
  duration_seconds: number | null;
  last_watched_at: string;
}

function toItem(row: ContinueWatchingRow): ContinueWatchingItem {
  const duration = row.duration_seconds ?? 0;
  const position = row.position_seconds ?? 0;
  const progressPercent = duration > 0 ? Math.min(100, Math.round((position / duration) * 100)) : 0;
  const remainingSeconds = Math.max(0, duration - position);
  return {
    franchise_key: row.franchise_key,
    anime_id: row.anime_id,
    title_romaji: row.title_romaji,
    title_english: row.title_english,
    season_label: row.season_label,
    episode_id: row.episode_id,
    episode_number: row.episode_number,
    progress_percent: progressPercent,
    remaining_seconds: remainingSeconds,
    last_watched_at: row.last_watched_at,
  };
}

export async function continueWatchingListHandler(context: Context): Promise<Response> {
  try {
    const claims = getClaims(context);
    const parsed = continueWatchingListSchema.safeParse(await context.req.json().catch(() => ({})));
    if (!parsed.success) {
      return context.json(fail("Invalid request body", 422), 422);
    }

    const rows = await query<ContinueWatchingRow[]>(SELECT_CONTINUE_WATCHING_LIST, [claims.user_id]);
    const responseData: ContinueWatchingListResponse = { items: rows.map(toItem) };
    return context.json(ok(responseData, "Continue watching list retrieved"), 200);
  } catch (err) {
    await logError("continueWatching.list", err);
    return context.json(fail("Internal server error", 500), 500);
  }
}
