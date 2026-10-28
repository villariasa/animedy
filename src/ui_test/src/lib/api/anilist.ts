// Direct browser → AniList GraphQL client. No backend, no accounts:
// network-first with IndexedDB fallback cache (same offline behaviour the
// old apiPostCached had). Maps AniList media into the app's existing UI types.
import { ApiError } from "$lib/api/client";
import type {
  AnimeDetails,
  AnimeFormat,
  AnimeSearchResultItem,
  AnimeSeason,
  AnimeStatus,
  EpisodeListItem,
  FranchiseEntry
} from "$lib/api/types";
import { getCached, putCached } from "$lib/db/local";

const ANILIST_URL = "https://graphql.anilist.co";

const MEDIA_FIELDS = `
  id
  idMal
  title { romaji english native }
  format
  status
  season
  seasonYear
  startDate { year month day }
  endDate { year month day }
  episodes
  duration
  description
  coverImage { extraLarge large }
  bannerImage
  nextAiringEpisode { episode }
`;

interface AniListMedia {
  id: number;
  idMal: number | null;
  title: { romaji: string | null; english: string | null; native: string | null };
  format: string | null;
  status: string | null;
  season: string | null;
  seasonYear: number | null;
  startDate: { year: number | null; month: number | null; day: number | null };
  endDate: { year: number | null; month: number | null; day: number | null };
  episodes: number | null;
  duration: number | null;
  description: string | null;
  coverImage: { extraLarge: string | null; large: string | null };
  bannerImage: string | null;
  nextAiringEpisode: { episode: number } | null;
  relations?: { edges: Array<{ relationType: string; node: AniListMedia }> };
}

async function gql<T>(key: string, query: string, variables: Record<string, unknown>): Promise<T> {
  try {
    const res = await fetch(ANILIST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables })
    });
    if (!res.ok) {
      throw new ApiError(`AniList request failed (${res.status})`, res.status);
    }
    const json = (await res.json()) as { data: T };
    await putCached(key, json.data).catch(() => undefined);
    return json.data;
  } catch (err) {
    // Offline / rate-limited → serve the last cached copy if we have one.
    const cached = await getCached<T>(key).catch(() => undefined);
    if (cached !== undefined) {
      return cached;
    }
    throw err instanceof ApiError ? err : new ApiError("Network error — check your connection.", 0);
  }
}

function fuzzyDate(d: { year: number | null; month: number | null; day: number | null }): string | null {
  if (!d.year) {
    return null;
  }
  return `${d.year}-${String(d.month ?? 1).padStart(2, "0")}-${String(d.day ?? 1).padStart(2, "0")}`;
}

function toSearchItem(m: AniListMedia): AnimeSearchResultItem {
  return {
    anime_id: m.id,
    anilist_id: m.id,
    mal_id: m.idMal,
    title_romaji: m.title.romaji,
    title_english: m.title.english,
    cover_image: m.coverImage.extraLarge ?? m.coverImage.large,
    format: (m.format as AnimeFormat) ?? null,
    status: (m.status as AnimeStatus) ?? null,
    season_year: m.seasonYear
  };
}

function toDetails(m: AniListMedia): AnimeDetails {
  return {
    id: m.id,
    anilist_id: m.id,
    mal_id: m.idMal,
    title_romaji: m.title.romaji,
    title_english: m.title.english,
    title_native: m.title.native,
    synonyms: null,
    format: (m.format as AnimeFormat) ?? null,
    status: (m.status as AnimeStatus) ?? null,
    season: (m.season as AnimeSeason) ?? null,
    season_year: m.seasonYear,
    start_date: fuzzyDate(m.startDate),
    end_date: fuzzyDate(m.endDate),
    episode_count: m.episodes ?? (m.nextAiringEpisode ? m.nextAiringEpisode.episode - 1 : null),
    episode_duration: m.duration,
    description: m.description,
    cover_image: m.coverImage.extraLarge ?? m.coverImage.large,
    banner_image: m.bannerImage,
    franchise_key: null,
    sequence_order: null,
    season_label: null,
    arc_name: null
  };
}

export async function searchAnime(search: string): Promise<AnimeSearchResultItem[]> {
  const data = await gql<{ Page: { media: AniListMedia[] } }>(
    `anilist:search:${search.toLowerCase()}`,
    `query ($search: String) {
      Page(page: 1, perPage: 24) {
        media(search: $search, type: ANIME, sort: SEARCH_MATCH, isAdult: false) { ${MEDIA_FIELDS} }
      }
    }`,
    { search }
  );
  return data.Page.media.map(toSearchItem);
}

export type BrowseTag = "trending" | "popular" | "top_rated" | "this_week" | "this_month";

export async function browseAnime(tag: BrowseTag): Promise<AnimeSearchResultItem[]> {
  const sortMap: Record<BrowseTag, string> = {
    trending: "TRENDING_DESC",
    popular: "POPULARITY_DESC",
    top_rated: "SCORE_DESC",
    this_week: "TRENDING_DESC",
    this_month: "POPULARITY_DESC"
  };
  // "this week/month" narrow to the season currently airing.
  const now = new Date();
  const month = now.getMonth() + 1;
  const season = month <= 3 ? "WINTER" : month <= 6 ? "SPRING" : month <= 9 ? "SUMMER" : "FALL";
  const seasonal = tag === "this_week" || tag === "this_month";
  const data = await gql<{ Page: { media: AniListMedia[] } }>(
    `anilist:browse:${tag}:${seasonal ? `${season}-${now.getFullYear()}` : "all"}`,
    `query ($sort: [MediaSort], $season: MediaSeason, $seasonYear: Int) {
      Page(page: 1, perPage: 24) {
        media(type: ANIME, sort: $sort, season: $season, seasonYear: $seasonYear, isAdult: false) { ${MEDIA_FIELDS} }
      }
    }`,
    {
      sort: [sortMap[tag]],
      season: seasonal ? season : null,
      seasonYear: seasonal ? now.getFullYear() : null
    }
  );
  return data.Page.media.map(toSearchItem);
}

async function fetchMedia(id: number, withRelations: boolean): Promise<AniListMedia> {
  const relationsFragment = withRelations
    ? `relations { edges { relationType node { ${MEDIA_FIELDS} } } }`
    : "";
  const data = await gql<{ Media: AniListMedia }>(
    `anilist:media:${id}:${withRelations ? "rel" : "base"}`,
    `query ($id: Int) { Media(id: $id, type: ANIME) { ${MEDIA_FIELDS} ${relationsFragment} } }`,
    { id }
  );
  return data.Media;
}

export async function getAnimeDetails(id: number): Promise<AnimeDetails> {
  return toDetails(await fetchMedia(id, false));
}

/** Synthesize the episode list from the episode count — streams come from
 * embed providers keyed by (anilist id, episode number), so episode "ids"
 * are just the episode numbers. */
export function buildEpisodes(anime: AnimeDetails): EpisodeListItem[] {
  const count = anime.episode_count ?? 0;
  const episodes: EpisodeListItem[] = [];
  for (let n = 1; n <= count; n += 1) {
    episodes.push({
      episode_id: n,
      episode_number: n,
      title: null,
      duration_seconds: anime.episode_duration ? anime.episode_duration * 60 : null,
      air_date: null,
      thumbnail: null
    });
  }
  return episodes;
}

function deriveSeasonLabel(m: AniListMedia, position: number): string {
  const title = m.title.english ?? m.title.romaji ?? "";
  let label: string;
  const seasonMatch = /season\s*(\d+)/i.exec(title);
  const partMatch = /part\s*(\d+)/i.exec(title);
  if (/final season/i.test(title)) {
    label = "Final Season";
  } else if (seasonMatch) {
    label = `Season ${seasonMatch[1]}${partMatch ? ` Part ${partMatch[1]}` : ""}`;
  } else if (partMatch) {
    label = `Part ${partMatch[1]}`;
  } else if (m.format === "MOVIE") {
    label = "Movie";
  } else if (m.format === "OVA" || m.format === "SPECIAL" || m.format === "ONA") {
    label = m.format === "OVA" ? "OVA" : m.format === "ONA" ? "ONA" : "Special";
  } else {
    label = `Season ${position + 1}`;
  }
  return label;
}

function startTimestamp(m: AniListMedia): number {
  const iso = fuzzyDate(m.startDate);
  return iso ? new Date(iso).getTime() : Number.MAX_SAFE_INTEGER;
}

/**
 * Client-side franchise walk: PREQUEL edges back to the root, SEQUEL edges
 * forward for the main chain (ordered by start date), side entries
 * (movies/OVAs/spin-offs) appended after. Bounded + cached per anime id.
 */
export async function getFranchise(id: number): Promise<FranchiseEntry[]> {
  const cacheKey = `anilist:franchise:${id}`;
  const cached = await getCached<FranchiseEntry[]>(cacheKey).catch(() => undefined);
  if (cached !== undefined) {
    return cached;
  }

  // Walk back to the root.
  let current = await fetchMedia(id, true);
  const visited = new Set<number>([current.id]);
  for (let hops = 0; hops < 15; hops += 1) {
    const prequel = current.relations?.edges.find((e) => e.relationType === "PREQUEL");
    if (!prequel || visited.has(prequel.node.id)) {
      break;
    }
    visited.add(prequel.node.id);
    current = await fetchMedia(prequel.node.id, true);
  }

  // BFS forward along SEQUEL edges, collecting side entries.
  const chain: AniListMedia[] = [];
  const side: AniListMedia[] = [];
  const seen = new Set<number>();
  const pending: AniListMedia[] = [current];
  while (pending.length > 0 && seen.size < 25) {
    const next = pending.shift();
    if (!next || seen.has(next.id)) {
      continue;
    }
    seen.add(next.id);
    const full = next.relations ? next : await fetchMedia(next.id, true);
    chain.push(full);
    for (const edge of full.relations?.edges ?? []) {
      if (edge.relationType === "SEQUEL" && !seen.has(edge.node.id)) {
        pending.push(edge.node);
      } else if (
        (edge.relationType === "SIDE_STORY" || edge.relationType === "SPIN_OFF" || edge.relationType === "ALTERNATIVE") &&
        !seen.has(edge.node.id) &&
        !side.some((s) => s.id === edge.node.id)
      ) {
        side.push(edge.node);
      }
    }
  }
  chain.sort((a, b) => startTimestamp(a) - startTimestamp(b));

  const entries: FranchiseEntry[] = chain.concat(side.filter((s) => !seen.has(s.id))).map((m, i) => ({
    anime_id: m.id,
    anilist_id: m.id,
    title_romaji: m.title.romaji,
    title_english: m.title.english,
    format: (m.format as AnimeFormat) ?? null,
    season_label: deriveSeasonLabel(m, i),
    arc_name: null,
    sequence_order: i + 1,
    episode_count: m.episodes,
    start_date: fuzzyDate(m.startDate)
  }));
  await putCached(cacheKey, entries).catch(() => undefined);
  return entries;
}
