import type { Context } from "hono";
import { query } from "../../lib/dbconn.js";
import { logError } from "../../lib/errorlogger.js";
import { ok, fail } from "../lib/response.js";
import { getClaims, getOptionalClaims } from "../utils/auth.js";
import { skipGetSchema, skipSetSchema } from "../schemas/skip.js";
import {
  SELECT_SKIP_SEGMENTS_BY_EPISODE_AND_SOURCE,
  UPSERT_SKIP_SEGMENT,
} from "../queries/skip.js";
import { SELECT_EPISODE_WITH_ANIME_MAL } from "../queries/episodes.js";
import { SELECT_SETTINGS_BY_USER } from "../queries/settings.js";
import { fetchAndCacheAniSkipSegments } from "../utils/aniskip.js";
import type { SkipSource, SkipTimestampRow, UserSettingsRow } from "../interfaces/db.js";
import type { SkipGetResponse, SkipSegment, SkipSetResponse } from "../interfaces/api.js";

interface EpisodeWithMal {
  id: number;
  anime_id: number;
  episode_number: number;
  mal_id: number | null;
}

function toSegment(row: SkipTimestampRow): SkipSegment {
  return {
    skip_type: row.skip_type,
    start_seconds: row.start_seconds,
    end_seconds: row.end_seconds,
    source: row.source,
  };
}

async function resolvePreferredSkipSource(context: Context, override?: SkipSource): Promise<SkipSource> {
  if (override) {
    return override;
  }
  const claims = getOptionalClaims(context);
  if (!claims) {
    return "aniskip";
  }
  const rows = await query<UserSettingsRow[]>(SELECT_SETTINGS_BY_USER, [claims.user_id]);
  return rows[0]?.skip_source ?? "aniskip";
}

export async function skipGetHandler(context: Context): Promise<Response> {
  try {
    const parsed = skipGetSchema.safeParse(await context.req.json().catch(() => ({})));
    if (!parsed.success) {
      return context.json(fail("Invalid request body", 422), 422);
    }
    const { episode_id, skip_source } = parsed.data;
    const preferredSource = await resolvePreferredSkipSource(context, skip_source);

    const [episode] = await query<EpisodeWithMal[]>(SELECT_EPISODE_WITH_ANIME_MAL, [episode_id]).catch(() => []);
    if (!episode) {
      const responseData: SkipGetResponse = { episode_id, segments: [] };
      return context.json(ok(responseData, "No skip segments found"), 200);
    }

    const sourceOrder: SkipSource[] =
      preferredSource === "aniskip" ? ["aniskip", "manual"] : ["manual", "aniskip"];

    for (const source of sourceOrder) {
      let rows = await query<SkipTimestampRow[]>(SELECT_SKIP_SEGMENTS_BY_EPISODE_AND_SOURCE, [
        episode_id,
        source,
      ]);

      if (rows.length === 0 && source === "aniskip" && episode.mal_id) {
        await fetchAndCacheAniSkipSegments(episode_id, episode.mal_id, episode.episode_number);
        rows = await query<SkipTimestampRow[]>(SELECT_SKIP_SEGMENTS_BY_EPISODE_AND_SOURCE, [
          episode_id,
          source,
        ]);
      }

      if (rows.length > 0) {
        const responseData: SkipGetResponse = { episode_id, segments: rows.map(toSegment) };
        return context.json(ok(responseData, "Skip segments retrieved"), 200);
      }
    }

    const responseData: SkipGetResponse = { episode_id, segments: [] };
    return context.json(ok(responseData, "No skip segments available"), 200);
  } catch (err) {
    await logError("skip.get", err);
    return context.json(fail("Internal server error", 500), 500);
  }
}

export async function skipSetHandler(context: Context): Promise<Response> {
  try {
    getClaims(context); // authRequired guarantees a valid caller; no claim fields needed here.
    const parsed = skipSetSchema.safeParse(await context.req.json().catch(() => ({})));
    if (!parsed.success) {
      return context.json(fail("Invalid request body", 422), 422);
    }
    const { episode_id, skip_type, start_seconds, end_seconds } = parsed.data;

    await query(UPSERT_SKIP_SEGMENT, [episode_id, skip_type, start_seconds, end_seconds, "manual"]);

    const responseData: SkipSetResponse = {
      episode_id,
      skip_type,
      start_seconds,
      end_seconds,
      source: "manual",
    };
    return context.json(ok(responseData, "Manual skip segment saved"), 200);
  } catch (err) {
    await logError("skip.set", err);
    return context.json(fail("Internal server error", 500), 500);
  }
}
