import type { Context } from "hono";
import { query } from "../../lib/dbconn.js";
import { logError } from "../../lib/errorlogger.js";
import { ok, fail } from "../lib/response.js";
import { adminEpisodesUpsertSchema } from "../schemas/admin.js";
import { SELECT_EPISODE_BY_ANIME_AND_NUMBER, UPSERT_EPISODE } from "../queries/episodes.js";
import type { EpisodeRow } from "../interfaces/db.js";
import type { AdminEpisodeUpsertResponse } from "../interfaces/api.js";

export async function adminEpisodesUpsertHandler(context: Context): Promise<Response> {
  try {
    const parsed = adminEpisodesUpsertSchema.safeParse(await context.req.json().catch(() => ({})));
    if (!parsed.success) {
      return context.json(fail("Invalid request body", 422), 422);
    }

    const episodeIds: number[] = [];
    for (const item of parsed.data.episodes) {
      await query(UPSERT_EPISODE, [
        item.anime_id,
        item.episode_number,
        item.title ?? null,
        item.duration_seconds ?? null,
        item.air_date ?? null,
        item.thumbnail ?? null,
        item.stream_url,
        item.subtitles ? JSON.stringify(item.subtitles) : null,
        item.qualities ? JSON.stringify(item.qualities) : null,
      ]);
      const [episode] = await query<EpisodeRow[]>(SELECT_EPISODE_BY_ANIME_AND_NUMBER, [
        item.anime_id,
        item.episode_number,
      ]);
      if (episode) {
        episodeIds.push(episode.id);
      }
    }

    const responseData: AdminEpisodeUpsertResponse = { episode_ids: episodeIds };
    return context.json(ok(responseData, "Episodes upserted"), 200);
  } catch (err) {
    await logError("admin.episodes.upsert", err);
    return context.json(fail("Internal server error", 500), 500);
  }
}
