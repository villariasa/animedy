// AniSkip REST client. Server-side only. Caches into `skip_timestamps`
// (source='aniskip'). See PRD.md §6.

import { query } from "../../lib/dbconn.js";
import { logError } from "../../lib/errorlogger.js";
import type { AniSkipResponse, AniSkipResult } from "../interfaces/external.js";
import type { SkipTimestampRow } from "../interfaces/db.js";
import { UPSERT_SKIP_SEGMENT } from "../queries/skip.js";
import { createThrottle } from "./throttle.js";

const ANISKIP_BASE = "https://api.aniskip.com/v2";
const throttle = createThrottle(500);

async function fetchAniSkipTimes(malId: number, episodeNumber: number, episodeLength = 1440): Promise<AniSkipResult[]> {
  return throttle(async () => {
    const epLength = Math.max(Math.round(episodeLength), 60);
    const url = `${ANISKIP_BASE}/skip-times/${malId}/${episodeNumber}?types[]=op&types[]=ed&episodeLength=${epLength}`;
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) {
        return [];
      }
      const payload = (await res.json()) as AniSkipResponse;
      return payload.found ? payload.results : [];
    } catch {
      return [];
    }
  });
}

function toSkipType(aniSkipType: AniSkipResult["skip_type"]): "intro" | "outro" | null {
  if (aniSkipType === "op" || aniSkipType === "mixed-op") {
    return "intro";
  }
  if (aniSkipType === "ed" || aniSkipType === "mixed-ed") {
    return "outro";
  }
  return null;
}

/**
 * Fetches AniSkip intro/outro timestamps for a given MAL id + episode number
 * and persists them into `skip_timestamps` with source='aniskip'. Returns
 * the number of segments cached. Swallows and logs individual failures so a
 * missing AniSkip entry never breaks the caller's fallback chain.
 */
export async function fetchAndCacheAniSkipSegments(
  episodeId: number,
  malId: number,
  episodeNumber: number,
): Promise<SkipTimestampRow[]> {
  try {
    const results = await fetchAniSkipTimes(malId, episodeNumber);
    const cached: SkipTimestampRow[] = [];
    for (const result of results) {
      const skipType = toSkipType(result.skip_type);
      if (!skipType) {
        continue;
      }
      await query(UPSERT_SKIP_SEGMENT, [
        episodeId,
        skipType,
        Math.round(result.interval.start_time),
        Math.round(result.interval.end_time),
        "aniskip",
      ]);
      cached.push({
        id: 0,
        episode_id: episodeId,
        skip_type: skipType,
        start_seconds: Math.round(result.interval.start_time),
        end_seconds: Math.round(result.interval.end_time),
        source: "aniskip",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    return cached;
  } catch (err) {
    await logError("aniskip.fetchAndCache", err);
    return [];
  }
}
