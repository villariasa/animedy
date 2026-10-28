// Direct browser → AniSkip client (free API, CORS-enabled). Fetches
// intro/outro windows by MAL id + episode number; failures return [].
import type { SkipSegment } from "$lib/api/types";
import { getCached, putCached } from "$lib/db/local";

interface AniSkipResult {
  skipType: string;
  interval: { startTime: number; endTime: number };
}

export async function getSkipSegments(
  malId: number | null,
  episodeNumber: number,
  episodeLengthSeconds = 0
): Promise<SkipSegment[]> {
  let segments: SkipSegment[] = [];
  if (malId !== null) {
    const key = `aniskip:${malId}:${episodeNumber}`;
    try {
      const url =
        `https://api.aniskip.com/v2/skip-times/${malId}/${episodeNumber}` +
        `?types[]=op&types[]=ed&types[]=recap&episodeLength=${episodeLengthSeconds}`;
      const res = await fetch(url);
      if (res.ok) {
        const payload = (await res.json()) as { found: boolean; results: AniSkipResult[] };
        if (payload.found) {
          segments = payload.results.map((r) => ({
            skip_type: r.skipType.includes("op") ? "intro" : r.skipType.includes("ed") ? "outro" : "recap",
            start_seconds: r.interval.startTime,
            end_seconds: r.interval.endTime,
            source: "aniskip" as const
          }));
        }
        await putCached(key, segments).catch(() => undefined);
      }
    } catch {
      segments = (await getCached<SkipSegment[]>(key).catch(() => undefined)) ?? [];
    }
  }
  return segments;
}
