import type { Context } from "hono";
import { query } from "../../lib/dbconn.js";
import { logError } from "../../lib/errorlogger.js";
import { ok, fail } from "../lib/response.js";
import { getClaims } from "../utils/auth.js";
import { historyListSchema } from "../schemas/progress.js";
import {
  SELECT_HISTORY_COMPLETED_COUNTS,
  SELECT_HISTORY_COUNT,
  SELECT_HISTORY_LIST,
} from "../queries/history.js";
import type {
  HistoryCompletedCount,
  HistoryListItem,
  HistoryListResponse,
} from "../interfaces/api.js";

interface HistoryRow {
  episode_id: number;
  anime_id: number;
  title_romaji: string | null;
  title_english: string | null;
  episode_number: number;
  episode_title: string | null;
  completed: 0 | 1;
  last_watched_at: string;
}

const DEFAULT_LIMIT = 50;

export async function historyListHandler(context: Context): Promise<Response> {
  try {
    const claims = getClaims(context);
    const parsed = historyListSchema.safeParse(await context.req.json().catch(() => ({})));
    if (!parsed.success) {
      return context.json(fail("Invalid request body", 422), 422);
    }
    const limit = parsed.data.limit ?? DEFAULT_LIMIT;
    const offset = parsed.data.offset ?? 0;

    const rows = await query<HistoryRow[]>(SELECT_HISTORY_LIST, [claims.user_id, limit, offset]);
    const [countRow] = await query<{ total: number }[]>(SELECT_HISTORY_COUNT, [claims.user_id]);
    const completedCountRows = await query<HistoryCompletedCount[]>(SELECT_HISTORY_COMPLETED_COUNTS, [
      claims.user_id,
    ]);

    const items: HistoryListItem[] = rows.map((row) => ({
      episode_id: row.episode_id,
      anime_id: row.anime_id,
      title_romaji: row.title_romaji,
      title_english: row.title_english,
      episode_number: row.episode_number,
      episode_title: row.episode_title,
      completed: row.completed === 1,
      last_watched_at: row.last_watched_at,
    }));

    const responseData: HistoryListResponse = {
      items,
      total: countRow?.total ?? 0,
      completed_counts: completedCountRows,
    };
    return context.json(ok(responseData, "History retrieved"), 200);
  } catch (err) {
    await logError("history.list", err);
    return context.json(fail("Internal server error", 500), 500);
  }
}
