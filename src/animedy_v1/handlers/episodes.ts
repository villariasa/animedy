import type { Context } from "hono";
import { query } from "../../lib/dbconn.js";
import { logError } from "../../lib/errorlogger.js";
import { ok, fail } from "../lib/response.js";
import { episodesListSchema, episodesSourcesSchema } from "../schemas/episodes.js";
import { SELECT_EPISODE_BY_ID, SELECT_EPISODES_BY_ANIME } from "../queries/episodes.js";
import type { EpisodeRow } from "../interfaces/db.js";
import type { EpisodeListItem, EpisodesListResponse, EpisodesSourcesResponse } from "../interfaces/api.js";

export async function episodesListHandler(context: Context): Promise<Response> {
  try {
    const parsed = episodesListSchema.safeParse(await context.req.json().catch(() => ({})));
    if (!parsed.success) {
      return context.json(fail("Invalid request body", 422), 422);
    }
    const rows = await query<EpisodeListItem[]>(SELECT_EPISODES_BY_ANIME, [parsed.data.anime_id]);
    const responseData: EpisodesListResponse = { episodes: rows };
    return context.json(ok(responseData, "Episodes retrieved"), 200);
  } catch (err) {
    await logError("episodes.list", err);
    return context.json(fail("Internal server error", 500), 500);
  }
}

export async function episodesSourcesHandler(context: Context): Promise<Response> {
  try {
    const parsed = episodesSourcesSchema.safeParse(await context.req.json().catch(() => ({})));
    if (!parsed.success) {
      return context.json(fail("Invalid request body", 422), 422);
    }
    const [episode] = await query<EpisodeRow[]>(SELECT_EPISODE_BY_ID, [parsed.data.episode_id]);
    if (!episode) {
      return context.json(fail("Episode not found", 404), 404);
    }
    const responseData: EpisodesSourcesResponse = {
      episode_id: episode.id,
      stream_url: episode.stream_url,
      subtitles: episode.subtitles_json ?? [],
      qualities: episode.qualities_json ?? [],
    };
    return context.json(ok(responseData, "Episode sources retrieved"), 200);
  } catch (err) {
    await logError("episodes.sources", err);
    return context.json(fail("Internal server error", 500), 500);
  }
}
