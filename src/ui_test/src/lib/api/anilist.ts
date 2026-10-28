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
  nextAiringEpisode { episode airingAt }
  trailer { id site }
  countryOfOrigin
  isAdult
  averageScore
  popularity
  genres
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
  averageScore: number | null;
  popularity: number | null;
  genres: string[] | null;
  nextAiringEpisode: { episode: number; airingAt: number } | null;
  trailer: { id: string | null; site: string | null } | null;
  countryOfOrigin: string | null;
  isAdult: boolean | null;
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
    banner_image: m.bannerImage,
    format: (m.format as AnimeFormat) ?? null,
    status: (m.status as AnimeStatus) ?? null,
    season_year: m.seasonYear,
    description: m.description,
    score: m.averageScore,
    genres: m.genres ?? [],
    latest_episode: m.nextAiringEpisode ? m.nextAiringEpisode.episode - 1 : m.episodes,
    trailer_thumbnail:
      m.trailer?.site === "youtube" && m.trailer.id
        ? `https://img.youtube.com/vi/${m.trailer.id}/maxresdefault.jpg`
        : null
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
    score: m.averageScore,
    popularity: m.popularity,
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
  if (data.Page.media.length > 0) {
    return data.Page.media.map(toSearchItem);
  }
  // AniList search has ZERO typo/prefix tolerance ("Friere" → nothing).
  // Fallback: Jikan (MAL) search IS fuzzy — take its MAL ids and resolve
  // them back through AniList so results stay in our normal shape.
  return searchViaJikan(search);
}

async function searchViaJikan(search: string): Promise<AnimeSearchResultItem[]> {
  let items: AnimeSearchResultItem[] = [];
  try {
    const res = await fetch(
      `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(search)}&limit=15&sfw=true`
    );
    if (res.ok) {
      const payload = (await res.json()) as { data: Array<{ mal_id: number }> };
      const malIds = payload.data.map((a) => a.mal_id).slice(0, 15);
      if (malIds.length > 0) {
        const mapped = await gql<{ Page: { media: AniListMedia[] } }>(
          `anilist:malmap:${malIds.join(",")}`,
          `query ($ids: [Int]) {
            Page(page: 1, perPage: 15) {
              media(idMal_in: $ids, type: ANIME, isAdult: false) { ${MEDIA_FIELDS} }
            }
          }`,
          { ids: malIds }
        );
        // Preserve Jikan's relevance order.
        const order = new Map(malIds.map((id, i) => [id, i]));
        items = mapped.Page.media
          .slice()
          .sort((a, b) => (order.get(a.idMal ?? -1) ?? 99) - (order.get(b.idMal ?? -1) ?? 99))
          .map(toSearchItem);
      }
    }
  } catch {
    items = [];
  }
  return items;
}

export type BrowseTag = "trending" | "popular" | "top_rated" | "this_week" | "this_month" | "new_releases";

export const BROWSE_PAGE_SIZE = 24;

export interface BrowsePage {
  items: AnimeSearchResultItem[];
  hasNextPage: boolean;
}

export async function browseAnime(tag: BrowseTag, page = 1): Promise<BrowsePage> {
  const sortMap: Record<BrowseTag, string> = {
    trending: "TRENDING_DESC", // AniList's realtime activity metric = "popular today"
    popular: "POPULARITY_DESC",
    top_rated: "SCORE_DESC",
    this_week: "TRENDING_DESC",
    this_month: "POPULARITY_DESC",
    new_releases: "START_DATE_DESC"
  };
  // "this week/month" narrow to the season currently airing.
  const now = new Date();
  const month = now.getMonth() + 1;
  const season = month <= 3 ? "WINTER" : month <= 6 ? "SPRING" : month <= 9 ? "SUMMER" : "FALL";
  const seasonal = tag === "this_week" || tag === "this_month";
  // Standard-rankings guardrails: Japanese anime only (no donghua flooding the
  // lists), and Top Rated needs a popularity floor — raw SCORE_DESC surfaces
  // obscure titles with a handful of votes, which is not how MAL/AniList
  // Top-100 style rankings work.
  // AniList 400s ("Illegal operator and value combination") when filter args
  // are passed as explicit nulls — only include the args we actually use.
  const mediaArgs = ['type: ANIME', "sort: $sort", "isAdult: false", 'countryOfOrigin: "JP"'];
  let varDefs = "$sort: [MediaSort]";
  const variables: Record<string, unknown> = { sort: [sortMap[tag]] };
  if (seasonal) {
    mediaArgs.push("season: $season", "seasonYear: $seasonYear");
    varDefs += ", $season: MediaSeason, $seasonYear: Int";
    variables.season = season;
    variables.seasonYear = now.getFullYear();
  }
  if (tag === "top_rated") {
    mediaArgs.push("popularity_greater: $minPopularity");
    varDefs += ", $minPopularity: Int";
    variables.minPopularity = 50000;
  }
  if (tag === "new_releases") {
    // Newest premieres that are actually out — exclude unaired announcements,
    // undated provisional entries, and zero-popularity catalogue noise.
    const fuzzyToday = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
    mediaArgs.push(
      "status_in: [RELEASING, FINISHED]",
      "popularity_greater: 1000",
      `startDate_lesser: ${fuzzyToday + 1}`
    );
  }
  const data = await gql<{ Page: { pageInfo: { hasNextPage: boolean }; media: AniListMedia[] } }>(
    `anilist:browse:v4:${tag}:p${page}:${seasonal ? `${season}-${now.getFullYear()}` : "all"}`,
    `query (${varDefs}, $page: Int) {
      Page(page: $page, perPage: ${BROWSE_PAGE_SIZE}) {
        pageInfo { hasNextPage }
        media(${mediaArgs.join(", ")}) { ${MEDIA_FIELDS} }
      }
    }`,
    { ...variables, page }
  );
  let media = data.Page.media;
  if (tag === "new_releases") {
    // AniList's startDate_lesser doesn't exclude null dates — drop undated
    // provisional entries client-side.
    media = media.filter((m) => m.startDate.year !== null);
  }
  return { items: media.map(toSearchItem), hasNextPage: data.Page.pageInfo.hasNextPage };
}

/** Back-compat helper for callers that only need the items (rankings rail). */
export async function browseAnimeItems(tag: BrowseTag, page = 1): Promise<AnimeSearchResultItem[]> {
  return (await browseAnime(tag, page)).items;
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
  const cacheKey = `anilist:franchise:v3:${id}`;
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
  // ONE chronological timeline: main chain + movies/OVAs/side stories all
  // sorted by premiere date (undated entries sink to the end).
  const all = chain.concat(side.filter((s) => !seen.has(s.id)));
  all.sort((a, b) => startTimestamp(a) - startTimestamp(b));

  const entries: FranchiseEntry[] = all.map((m, i) => ({
    anime_id: m.id,
    anilist_id: m.id,
    title_romaji: m.title.romaji,
    title_english: m.title.english,
    format: (m.format as AnimeFormat) ?? null,
    status: (m.status as AnimeStatus) ?? null,
    season_label: deriveSeasonLabel(m, i),
    arc_name: null,
    sequence_order: i + 1,
    episode_count: m.episodes,
    start_date: fuzzyDate(m.startDate)
  }));
  await putCached(cacheKey, entries).catch(() => undefined);
  return entries;
}

// ---------- Airing data (Today Release tab, liked-anime notifications) ----------

export type ReleaseTag = "new_episode" | "new_anime" | "new_season";

export interface TodayRelease {
  item: AnimeSearchResultItem;
  episode: number;
  airingAt: number;
  tag: ReleaseTag;
}

function classifyRelease(episode: number, m: AniListMedia): ReleaseTag {
  let tag: ReleaseTag = "new_episode";
  if (episode === 1) {
    const title = `${m.title.english ?? ""} ${m.title.romaji ?? ""}`;
    tag = /season|part\s*\d|2nd|3rd|[4-9]th|final|cour/i.test(title) ? "new_season" : "new_anime";
  }
  return tag;
}

/** Episodes that aired TODAY (local midnight → now), Japanese anime only. */
export async function getTodayReleases(): Promise<TodayRelease[]> {
  const now = new Date();
  const dayStart = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000);
  const dayKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  const data = await gql<{ Page: { airingSchedules: Array<{ episode: number; airingAt: number; media: AniListMedia }> } }>(
    `anilist:today:${dayKey}`,
    `query ($start: Int, $end: Int) {
      Page(page: 1, perPage: 50) {
        airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME_DESC) {
          episode
          airingAt
          media { ${MEDIA_FIELDS} }
        }
      }
    }`,
    { start: dayStart, end: Math.floor(Date.now() / 1000) }
  );
  const byAnime = new Map<number, TodayRelease>();
  for (const s of data.Page.airingSchedules) {
    const m = s.media;
    if (m.countryOfOrigin !== "JP" || m.isAdult || m.format === "MUSIC") {
      continue;
    }
    const existing = byAnime.get(m.id);
    if (!existing || s.episode > existing.episode) {
      byAnime.set(m.id, {
        item: toSearchItem(m),
        episode: s.episode,
        airingAt: s.airingAt,
        tag: classifyRelease(s.episode, m)
      });
    }
  }
  return [...byAnime.values()].sort((x, y) => y.airingAt - x.airingAt);
}

export interface AiringInfo {
  id: number;
  status: AnimeStatus | null;
  latest_episode: number | null;
  next_episode: number | null;
  next_airing_at: number | null;
}

/** Batch airing/status info for a set of anime ids (liked list). */
export async function getAiringInfo(ids: number[]): Promise<Map<number, AiringInfo>> {
  const map = new Map<number, AiringInfo>();
  if (ids.length > 0) {
    const data = await gql<{ Page: { media: AniListMedia[] } }>(
      `anilist:airing:${[...ids].sort((a, b) => a - b).join(",")}`,
      `query ($ids: [Int]) {
        Page(page: 1, perPage: 50) {
          media(id_in: $ids, type: ANIME) { id status episodes nextAiringEpisode { episode airingAt } }
        }
      }`,
      { ids: ids.slice(0, 50) }
    );
    for (const m of data.Page.media) {
      map.set(m.id, {
        id: m.id,
        status: (m.status as AnimeStatus) ?? null,
        latest_episode: m.nextAiringEpisode ? m.nextAiringEpisode.episode - 1 : m.episodes,
        next_episode: m.nextAiringEpisode?.episode ?? null,
        next_airing_at: m.nextAiringEpisode?.airingAt ?? null
      });
    }
  }
  return map;
}

/** Per-episode thumbnails + titles. Primary: AniList streamingEpisodes
 * (Crunchyroll). Fallback: Jikan /videos/episodes (MAL episode stills) for
 * the many shows AniList hasn't indexed. */
export async function getEpisodeMedia(
  id: number,
  malId: number | null = null
): Promise<Map<number, { thumbnail: string | null; title: string | null }>> {
  const map = new Map<number, { thumbnail: string | null; title: string | null }>();
  try {
    const data = await gql<{ Media: { streamingEpisodes: Array<{ title: string | null; thumbnail: string | null }> } }>(
      `anilist:epthumbs:${id}`,
      `query ($id: Int) { Media(id: $id, type: ANIME) { streamingEpisodes { title thumbnail } } }`,
      { id }
    );
    const eps = data.Media.streamingEpisodes ?? [];
    for (let i = 0; i < eps.length; i += 1) {
      const raw = eps[i];
      if (!raw) continue;
      const m = /episode\s*(\d+)/i.exec(raw.title ?? "");
      const num = m ? parseInt(m[1] ?? "", 10) : i + 1;
      if (num > 0 && !map.has(num)) {
        map.set(num, {
          thumbnail: raw.thumbnail,
          title: raw.title ? raw.title.replace(/^episode\s*\d+\s*[-–—:]\s*/i, "") : null
        });
      }
    }
  } catch {
    // fall through to Jikan
  }

  if (map.size === 0 && malId !== null) {
    const cacheKey = `jikan:epthumbs:${malId}`;
    try {
      interface JikanEpVideo {
        episode: string | null;
        title: string | null;
        images: { jpg: { image_url: string | null } } | null;
      }
      const collected: JikanEpVideo[] = [];
      for (let page = 1; page <= 2; page += 1) {
        const res = await fetch(`https://api.jikan.moe/v4/anime/${malId}/videos/episodes?page=${page}`);
        if (!res.ok) break;
        const payload = (await res.json()) as {
          data: JikanEpVideo[];
          pagination?: { has_next_page?: boolean };
        };
        collected.push(...payload.data);
        if (!payload.pagination?.has_next_page) break;
      }
      for (const ep of collected) {
        const m = /episode\s*(\d+)/i.exec(ep.episode ?? "");
        const num = m ? parseInt(m[1] ?? "", 10) : 0;
        if (num > 0 && !map.has(num)) {
          map.set(num, { thumbnail: ep.images?.jpg?.image_url ?? null, title: ep.title });
        }
      }
      if (map.size > 0) {
        await putCached(cacheKey, [...map.entries()]).catch(() => undefined);
      }
    } catch {
      const cached = await getCached<Array<[number, { thumbnail: string | null; title: string | null }]>>(cacheKey).catch(() => undefined);
      if (cached) {
        for (const [k, v] of cached) map.set(k, v);
      }
    }
  }
  return map;
}
