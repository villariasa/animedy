// Jikan (MAL) — used as a fallback trailer source for anime where AniList's
// own `trailer` field is empty (e.g. Cyberpunk: Edgerunners), so the hero
// carousel still has a video to play instead of falling back to a still image.
import { getCached, putCached } from "$lib/db/local";

interface JikanAnimeResponse {
  data?: { trailer?: { youtube_id?: string | null } | null } | null;
}

export async function getFallbackTrailerId(malId: number): Promise<string | null> {
  const cacheKey = `jikan:trailer:${malId}`;
  const cached = await getCached<string | null>(cacheKey).catch(() => undefined);
  if (cached !== undefined) {
    return cached;
  }
  let trailerId: string | null = null;
  try {
    const res = await fetch(`https://api.jikan.moe/v4/anime/${malId}`);
    if (res.ok) {
      const payload = (await res.json()) as JikanAnimeResponse;
      trailerId = payload.data?.trailer?.youtube_id ?? null;
    }
  } catch {
    trailerId = null;
  }
  await putCached(cacheKey, trailerId).catch(() => undefined);
  return trailerId;
}
