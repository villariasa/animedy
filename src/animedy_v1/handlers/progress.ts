import type { Context } from "hono";
import { query } from "../../lib/dbconn.js";
import { logError } from "../../lib/errorlogger.js";
import { ok, fail } from "../lib/response.js";
import { getClaims } from "../utils/auth.js";
import { progressCompleteSchema, progressGetSchema, progressSaveSchema } from "../schemas/progress.js";
import {
  SELECT_WATCH_PROGRESS,
  UPSERT_WATCH_PROGRESS,
  UPSERT_WATCH_STATE,
} from "../queries/progress.js";
import {
  SELECT_EPISODE_ANIME_INFO,
  SELECT_FIRST_EPISODE_OF_ANIME,
  SELECT_NEXT_EPISODE,
} from "../queries/episodes.js";
import { SELECT_NEXT_FRANCHISE_ENTRY } from "../queries/anime.js";
import type { WatchProgressRow } from "../interfaces/db.js";
import type {
  ProgressCompleteResponse,
  ProgressGetResponse,
  ProgressSaveResponse,
} from "../interfaces/api.js";

const COMPLETION_THRESHOLD = 0.9;

interface EpisodeAnimeInfo {
  episode_id: number;
  anime_id: number;
  episode_number: number;
  franchise_key: string | null;
  sequence_order: number | null;
}

interface MinimalEpisode {
  id: number;
  anime_id: number;
  episode_number: number;
}

interface MinimalAnime {
  id: number;
  sequence_order: number | null;
}

async function loadEpisodeInfo(episodeId: number): Promise<EpisodeAnimeInfo | null> {
  const [row] = await query<EpisodeAnimeInfo[]>(SELECT_EPISODE_ANIME_INFO, [episodeId]);
  return row ?? null;
}

export async function progressSaveHandler(context: Context): Promise<Response> {
  try {
    const claims = getClaims(context);
    const parsed = progressSaveSchema.safeParse(await context.req.json().catch(() => ({})));
    if (!parsed.success) {
      return context.json(fail("Invalid request body", 422), 422);
    }
    const { episode_id, position_seconds, duration_seconds } = parsed.data;

    const info = await loadEpisodeInfo(episode_id);
    if (!info) {
      return context.json(fail("Episode not found", 404), 404);
    }

    const completed = duration_seconds > 0 && position_seconds / duration_seconds >= COMPLETION_THRESHOLD;
    await query(UPSERT_WATCH_PROGRESS, [
      claims.user_id,
      episode_id,
      position_seconds,
      duration_seconds,
      completed ? 1 : 0,
    ]);

    const franchiseKey = info.franchise_key ?? String(info.anime_id);
    await query(UPSERT_WATCH_STATE, [claims.user_id, franchiseKey, info.anime_id, episode_id, 0, 0]);

    const responseData: ProgressSaveResponse = { episode_id, position_seconds, completed };
    return context.json(ok(responseData, "Progress saved"), 200);
  } catch (err) {
    await logError("progress.save", err);
    return context.json(fail("Internal server error", 500), 500);
  }
}

export async function progressGetHandler(context: Context): Promise<Response> {
  try {
    const claims = getClaims(context);
    const parsed = progressGetSchema.safeParse(await context.req.json().catch(() => ({})));
    if (!parsed.success) {
      return context.json(fail("Invalid request body", 422), 422);
    }

    const [row] = await query<WatchProgressRow[]>(SELECT_WATCH_PROGRESS, [
      claims.user_id,
      parsed.data.episode_id,
    ]);
    const responseData: ProgressGetResponse = row
      ? {
          episode_id: row.episode_id,
          position_seconds: row.position_seconds,
          duration_seconds: row.duration_seconds,
          completed: row.completed === 1,
          last_watched_at: row.last_watched_at,
        }
      : {
          episode_id: parsed.data.episode_id,
          position_seconds: 0,
          duration_seconds: 0,
          completed: false,
          last_watched_at: null,
        };
    return context.json(ok(responseData, "Progress retrieved"), 200);
  } catch (err) {
    await logError("progress.get", err);
    return context.json(fail("Internal server error", 500), 500);
  }
}

export async function progressCompleteHandler(context: Context): Promise<Response> {
  try {
    const claims = getClaims(context);
    const parsed = progressCompleteSchema.safeParse(await context.req.json().catch(() => ({})));
    if (!parsed.success) {
      return context.json(fail("Invalid request body", 422), 422);
    }
    const { episode_id } = parsed.data;

    const info = await loadEpisodeInfo(episode_id);
    if (!info) {
      return context.json(fail("Episode not found", 404), 404);
    }

    const [existingProgress] = await query<WatchProgressRow[]>(SELECT_WATCH_PROGRESS, [
      claims.user_id,
      episode_id,
    ]);
    const durationSeconds = existingProgress?.duration_seconds ?? 0;
    await query(UPSERT_WATCH_PROGRESS, [claims.user_id, episode_id, durationSeconds, durationSeconds, 1]);

    const franchiseKey = info.franchise_key ?? String(info.anime_id);

    const [nextEpisode] = await query<MinimalEpisode[]>(SELECT_NEXT_EPISODE, [
      info.anime_id,
      info.episode_number,
    ]);
    if (nextEpisode) {
      await query(UPSERT_WATCH_STATE, [claims.user_id, franchiseKey, info.anime_id, nextEpisode.id, 0, 0]);
      const responseData: ProgressCompleteResponse = {
        episode_id,
        franchise_key: franchiseKey,
        next_episode_id: nextEpisode.id,
        franchise_completed: false,
      };
      return context.json(ok(responseData, "Episode completed; advanced to next episode"), 200);
    }

    if (info.sequence_order !== null && info.franchise_key) {
      const [nextAnime] = await query<MinimalAnime[]>(SELECT_NEXT_FRANCHISE_ENTRY, [
        info.franchise_key,
        info.sequence_order,
      ]);
      if (nextAnime) {
        const [firstEpisode] = await query<MinimalEpisode[]>(SELECT_FIRST_EPISODE_OF_ANIME, [nextAnime.id]);
        await query(UPSERT_WATCH_STATE, [
          claims.user_id,
          franchiseKey,
          nextAnime.id,
          firstEpisode?.id ?? null,
          1,
          0,
        ]);
        const responseData: ProgressCompleteResponse = {
          episode_id,
          franchise_key: franchiseKey,
          next_episode_id: firstEpisode?.id ?? null,
          franchise_completed: false,
        };
        return context.json(ok(responseData, "Series completed; advanced to next franchise entry"), 200);
      }
    }

    await query(UPSERT_WATCH_STATE, [claims.user_id, franchiseKey, info.anime_id, episode_id, 1, 1]);
    const responseData: ProgressCompleteResponse = {
      episode_id,
      franchise_key: franchiseKey,
      next_episode_id: null,
      franchise_completed: true,
    };
    return context.json(ok(responseData, "Franchise completed"), 200);
  } catch (err) {
    await logError("progress.complete", err);
    return context.json(fail("Internal server error", 500), 500);
  }
}
