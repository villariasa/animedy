// Kitsu (free, CORS-open JSON:API) — used ONLY for its high-res panoramic
// cover images (up to 3360×800), which beat AniList's ~1900×400 banners for
// the hero carousel. Looked up by AniList id via Kitsu's mappings endpoint.
import { getCached, putCached } from "$lib/db/local";

interface KitsuMappingResponse {
  included?: Array<{
    attributes?: {
      coverImage?: { original?: string | null; large?: string | null } | null;
    };
  }>;
}

export async function getHDBanner(anilistId: number): Promise<string | null> {
  const cacheKey = `kitsu:banner:${anilistId}`;
  const cached = await getCached<string | null>(cacheKey).catch(() => undefined);
  if (cached !== undefined) {
    return cached;
  }
  let banner: string | null = null;
  try {
    const res = await fetch(
      `https://kitsu.io/api/edge/mappings?filter[externalSite]=anilist/anime&filter[externalId]=${anilistId}&include=item&fields[anime]=coverImage`,
      { headers: { Accept: "application/vnd.api+json" } }
    );
    if (res.ok) {
      const payload = (await res.json()) as KitsuMappingResponse;
      const cover = payload.included?.[0]?.attributes?.coverImage;
      banner = cover?.original ?? cover?.large ?? null;
    }
    await putCached(cacheKey, banner).catch(() => undefined);
  } catch {
    banner = null;
  }
  return banner;
}
