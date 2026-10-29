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
  type
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
  type?: string | null;
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function gql<T>(key: string, query: string, variables: Record<string, unknown>): Promise<T> {
  try {
    let res = await fetch(ANILIST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables })
    });
    // AniList rate-limits (429) and publishes how long to wait via Retry-After.
    // Worth one short automatic retry so a brief burst doesn't surface as an
    // error; a long cooldown just fails fast with an accurate message instead
    // of hanging the UI.
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After"));
      if (Number.isFinite(retryAfter) && retryAfter > 0 && retryAfter <= 5) {
        await sleep(retryAfter * 1000);
        res = await fetch(ANILIST_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ query, variables })
        });
      } else {
        throw new ApiError(
          `AniList is rate-limiting requests — try again in ${Number.isFinite(retryAfter) ? retryAfter : 60}s.`,
          429
        );
      }
    }
    if (!res.ok) {
      throw new ApiError(`AniList request failed (${res.status})`, res.status);
    }
    const json = (await res.json()) as { data: T };
    await putCached(key, json.data).catch(() => undefined);
    return json.data;
  } catch (err) {
    // Offline → serve the last cached copy if we have one.
    const cached = await getCached<T>(key).catch(() => undefined);
    if (cached !== undefined) {
      return cached;
    }
    if (err instanceof ApiError) throw err;
    // Surface what the browser's fetch actually failed with (e.g. "Failed to
    // fetch", a TypeError name, a CORS/mixed-content message) instead of a
    // blanket message that hides whether this is a real outage, a blocked
    // request, or something else entirely.
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    throw new ApiError(`Network error — check your connection. (${detail})`, 0);
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
        : null,
    trailer_id: m.trailer?.site === "youtube" && m.trailer.id ? m.trailer.id : null
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
    genres: m.genres ?? [],
    franchise_key: null,
    sequence_order: null,
    season_label: null,
    arc_name: null,
    trailer_id: m.trailer?.site === "youtube" && m.trailer.id ? m.trailer.id : null
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

/** Fixed AniList genre list (AniList has no "list genres" query worth a
 * round trip for — these are the canonical values its schema accepts). */
export const ANILIST_GENRES = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Ecchi",
  "Fantasy",
  "Horror",
  "Mahou Shoujo",
  "Mecha",
  "Music",
  "Mystery",
  "Psychological",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Thriller"
] as const;

export interface BrowseFilters {
  genre?: string | null;
  year?: number | null;
  format?: AnimeFormat | null;
}

export interface BrowsePage {
  items: AnimeSearchResultItem[];
  hasNextPage: boolean;
}

export async function browseAnime(tag: BrowseTag, page = 1, filters?: BrowseFilters): Promise<BrowsePage> {
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
  if (filters?.genre) {
    mediaArgs.push("genre_in: $filterGenre");
    varDefs += ", $filterGenre: [String]";
    variables.filterGenre = [filters.genre];
  }
  if (filters?.year && !seasonal) {
    mediaArgs.push("seasonYear: $filterYear");
    varDefs += ", $filterYear: Int";
    variables.filterYear = filters.year;
  }
  if (filters?.format) {
    mediaArgs.push("format: $filterFormat");
    varDefs += ", $filterFormat: MediaFormat";
    variables.filterFormat = filters.format;
  }
  const filterKey = `${filters?.genre ?? ""}:${filters?.year ?? ""}:${filters?.format ?? ""}`;
  const data = await gql<{ Page: { pageInfo: { hasNextPage: boolean }; media: AniListMedia[] } }>(
    `anilist:browse:v5:${tag}:p${page}:${seasonal ? `${season}-${now.getFullYear()}` : "all"}:${filterKey}`,
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

/**
 * Hero Spotlight feed — ranking-based, not a recommendation algorithm.
 * AniList's "trending" ranking (TRENDING_DESC, real-time community activity —
 * the same external ranking "Popular Today" already surfaces) is the sole
 * source of truth: entries are returned in that exact order. We walk deeper
 * pages of the SAME trending ranking (never a different ranking like
 * popularity/score) only to skip entries AniList has no banner art for,
 * since the Spotlight UI requires one — ranked anime are never reordered or
 * swapped for an unrelated pick.
 */
export async function getTrendingSpotlight(count: number): Promise<AnimeSearchResultItem[]> {
  const items: AnimeSearchResultItem[] = [];
  let page = 1;
  const maxPages = 3; // trending is a deep list; this is far more than enough headroom
  while (items.length < count && page <= maxPages) {
    const pageResult = await browseAnime("trending", page);
    for (const item of pageResult.items) {
      if (item.banner_image) items.push(item);
      if (items.length >= count) break;
    }
    if (!pageResult.hasNextPage) break;
    page += 1;
  }
  return items.slice(0, count);
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

/** "You might also like" — AniList's community-ranked recommendations for
 * this title, filtered to anime (AniList also recommends manga/other types). */
export async function getRecommendations(id: number): Promise<AnimeSearchResultItem[]> {
  const data = await gql<{
    Media: { recommendations: { nodes: Array<{ mediaRecommendation: AniListMedia | null }> } };
  }>(
    `anilist:recommendations:${id}`,
    `query ($id: Int) {
      Media(id: $id, type: ANIME) {
        recommendations(sort: RATING_DESC, perPage: 12) {
          nodes { mediaRecommendation { ${MEDIA_FIELDS} } }
        }
      }
    }`,
    { id }
  );
  return data.Media.recommendations.nodes
    .map((n) => n.mediaRecommendation)
    .filter((m): m is AniListMedia => m !== null && m.type === "ANIME")
    .map(toSearchItem);
}

/** Synthesize the episode list from the episode count — streams come from
 * embed providers keyed by (anilist id, episode number), so episode "ids"
 * are just the episode numbers. */
export function buildEpisodes(anime: AnimeDetails): EpisodeListItem[] {
  const count = anime.episode_count ?? 0;
  const episodes: EpisodeListItem[] = [];
  const parts = anime.start_date ? anime.start_date.split("-") : null;
  const p0 = parts?.[0];
  const p1 = parts?.[1];
  const p2 = parts?.[2];
  const baseDate =
    p0 && p1 && p2
      ? new Date(parseInt(p0, 10), parseInt(p1, 10) - 1, parseInt(p2, 10))
      : null;

  for (let n = 1; n <= count; n += 1) {
    let airDate: string | null = null;
    if (baseDate && !isNaN(baseDate.getTime())) {
      const epDate = new Date(baseDate);
      epDate.setDate(epDate.getDate() + (n - 1) * 7);
      airDate = epDate.toISOString().slice(0, 10);
    }
    episodes.push({
      episode_id: n,
      episode_number: n,
      title: null,
      duration_seconds: anime.episode_duration ? anime.episode_duration * 60 : null,
      air_date: airDate,
      thumbnail: null
    });
  }
  return episodes;
}

function deriveSeasonLabel(m: AniListMedia, tvSeasonNumber?: number): string {
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
  } else if (m.format === "OVA" || m.format === "SPECIAL") {
    label = m.format === "OVA" ? "OVA" : "Special";
  } else if (tvSeasonNumber !== undefined && tvSeasonNumber > 0) {
    label = `Season ${tvSeasonNumber}`;
  } else {
    label = m.format === "ONA" ? "ONA" : "TV";
  }
  return label;
}

function startTimestamp(m: AniListMedia): number {
  const iso = fuzzyDate(m.startDate);
  return iso ? new Date(iso).getTime() : Number.MAX_SAFE_INTEGER;
}

const ANIME_FORMATS = new Set(["TV", "TV_SHORT", "MOVIE", "SPECIAL", "OVA", "ONA"]);
const EXPAND_RELATIONS = new Set(["PREQUEL", "SEQUEL", "PARENT", "OTHER"]);
const INCLUDE_RELATIONS = new Set([
  "PREQUEL",
  "SEQUEL",
  "PARENT",
  "SIDE_STORY",
  "SPIN_OFF",
  "ALTERNATIVE",
  "OTHER",
  "SUMMARY"
]);

/**
 * Client-side franchise walk: BFS traversal following prequel, sequel,
 * parent, side story, and related anime edges. Sorted chronologically
 * by release date and cached per anime id.
 */
export async function getFranchise(id: number): Promise<FranchiseEntry[]> {
  const cacheKey = `anilist:franchise:v5:${id}`;
  const cached = await getCached<FranchiseEntry[]>(cacheKey).catch(() => undefined);
  if (cached !== undefined) {
    return cached;
  }

  const mediaMap = new Map<number, AniListMedia>();
  const visitedForExpansion = new Set<number>();
  const queue: number[] = [id];

  let fetchCount = 0;
  while (queue.length > 0 && fetchCount < 8) {
    const curId = queue.shift();
    if (!curId || visitedForExpansion.has(curId)) continue;
    visitedForExpansion.add(curId);

    fetchCount += 1;
    let media: AniListMedia | null = null;
    try {
      media = await fetchMedia(curId, true);
    } catch {
      continue;
    }
    if (!media) continue;
    mediaMap.set(media.id, media);

    for (const edge of media.relations?.edges ?? []) {
      const node = edge.node;
      if (!node?.id) continue;
      if (!INCLUDE_RELATIONS.has(edge.relationType)) continue;
      if (node.format && !ANIME_FORMATS.has(node.format)) continue;

      if (!mediaMap.has(node.id)) {
        mediaMap.set(node.id, node);
      }

      if (
        EXPAND_RELATIONS.has(edge.relationType) &&
        !visitedForExpansion.has(node.id) &&
        queue.length < 6
      ) {
        queue.push(node.id);
      }
    }
  }

  const all = [...mediaMap.values()];
  all.sort((a, b) => startTimestamp(a) - startTimestamp(b));

  let tvCount = 0;
  const entries: FranchiseEntry[] = all.map((m, i) => {
    let tvNum: number | undefined;
    if (m.format === "TV" || m.format === "TV_SHORT" || m.format === "ONA") {
      tvCount += 1;
      tvNum = tvCount;
    }
    return {
      anime_id: m.id,
      anilist_id: m.id,
      title_romaji: m.title.romaji,
      title_english: m.title.english,
      cover_image: m.coverImage?.extraLarge ?? m.coverImage?.large ?? null,
      format: (m.format as AnimeFormat) ?? null,
      status: (m.status as AnimeStatus) ?? null,
      season_label: deriveSeasonLabel(m, tvNum),
      arc_name: null,
      sequence_order: i + 1,
      episode_count: m.episodes,
      start_date: fuzzyDate(m.startDate)
    };
  });

  if (entries.length > 0) {
    await putCached(cacheKey, entries).catch(() => undefined);
  }
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

export const LATEST_RELEASE_PAGE_SIZE = 25;
// Raw AniList airingSchedules fetched per page before per-anime dedup/filtering —
// a buffer well above LATEST_RELEASE_PAGE_SIZE since multiple episodes can land
// close together and several belong to the same anime.
const LATEST_RELEASE_FETCH_SIZE = 50;

export interface LatestReleasePage extends BrowsePage {
  /** Raw AniList airingSchedules page cursor to resume from for the next UI page. */
  nextRawPage: number;
}

// Safety cap on raw AniList pages pulled per UI page — only kicks in when
// aggressive filters or heavy duplicate-episode clustering would otherwise
// require unbounded fetching to fill a page.
const LATEST_RELEASE_MAX_RAW_FETCHES = 6;

/**
 * Anime with the most recently AIRED episode first — this is the actual
 * recency signal (airingSchedules.airingAt), not AniList's `updatedAt`
 * (that field tracks when the catalogue entry's metadata was last edited by
 * moderators, which has nothing to do with new episodes and is why sorting
 * by it previously surfaced stale/old anime).
 *
 * `anchorAt` pins the "now" boundary for the whole paging session so later
 * pages continue chronologically right where the previous one left off
 * instead of sliding forward in time on every request — call site should
 * compute it once (e.g. on tab load) and reuse it for subsequent requests.
 *
 * `excludeIds` is the set of anime ids already shown on an earlier UI page
 * this session — an anime's airing history can span several raw AniList
 * pages (one schedule entry per episode), so without this an older episode
 * of a show already shown with its newer episode could resurface on a later
 * page. Callers should accumulate every returned item's `anime_id` into this
 * set and pass it back in on the next call. `rawPage` is AniList's own page
 * cursor into airingSchedules — pass 1 for a fresh session, then whatever
 * `nextRawPage` the previous call returned to continue forward.
 */
export async function getLatestReleases(
  rawPage: number,
  anchorAt: number,
  excludeIds: Set<number>,
  filters?: BrowseFilters
): Promise<LatestReleasePage> {
  const filterKey = `${filters?.genre ?? ""}:${filters?.year ?? ""}:${filters?.format ?? ""}`;
  const collected: Array<{ item: AnimeSearchResultItem; airingAt: number }> = [];
  const collectedIds = new Set<number>();
  let page = rawPage;
  let hasNextRaw = true;
  let fetches = 0;

  while (collected.length < LATEST_RELEASE_PAGE_SIZE && hasNextRaw && fetches < LATEST_RELEASE_MAX_RAW_FETCHES) {
    const data = await gql<{
      Page: {
        pageInfo: { hasNextPage: boolean };
        airingSchedules: Array<{ episode: number; airingAt: number; media: AniListMedia }>;
      };
    }>(
      `anilist:latest:v2:${anchorAt}:p${page}`,
      `query ($anchor: Int, $page: Int) {
        Page(page: $page, perPage: ${LATEST_RELEASE_FETCH_SIZE}) {
          pageInfo { hasNextPage }
          airingSchedules(airingAt_lesser: $anchor, sort: TIME_DESC) {
            episode
            airingAt
            media { ${MEDIA_FIELDS} }
          }
        }
      }`,
      { anchor: anchorAt, page }
    );
    fetches += 1;
    page += 1;
    hasNextRaw = data.Page.pageInfo.hasNextPage;

    // One entry per anime within this batch — keep whichever episode aired
    // most recently (a show can have more than one schedule entry here).
    const byAnime = new Map<number, { item: AnimeSearchResultItem; airingAt: number }>();
    for (const s of data.Page.airingSchedules) {
      const m = s.media;
      if (m.countryOfOrigin !== "JP" || m.isAdult || m.format === "MUSIC") continue;
      if (excludeIds.has(m.id) || collectedIds.has(m.id)) continue;
      const existing = byAnime.get(m.id);
      if (!existing || s.airingAt > existing.airingAt) {
        byAnime.set(m.id, { item: toSearchItem(m), airingAt: s.airingAt });
      }
    }

    let batch = [...byAnime.values()];
    if (filters?.genre) batch = batch.filter((e) => e.item.genres?.includes(filters.genre as string));
    if (filters?.year) batch = batch.filter((e) => e.item.season_year === filters.year);
    if (filters?.format) batch = batch.filter((e) => e.item.format === filters.format);
    batch.sort((a, b) => b.airingAt - a.airingAt);

    for (const e of batch) {
      if (collected.length >= LATEST_RELEASE_PAGE_SIZE) break;
      collected.push(e);
      collectedIds.add(e.item.anime_id);
    }
  }

  return {
    items: collected.map((e) => e.item),
    hasNextPage: hasNextRaw,
    nextRawPage: page
  };
}

export interface AiringScheduleEntry {
  id: number;
  anime_id: number;
  title_english: string | null;
  title_romaji: string | null;
  episode: number;
  airing_at: number;
  cover_image: string | null;
  banner_image: string | null;
  format: AnimeFormat | null;
}

/** Airing schedule entries for a specific day window (Japanese anime only). */
export async function getAiringSchedule(
  startTimestampSeconds: number,
  endTimestampSeconds: number
): Promise<AiringScheduleEntry[]> {
  const cacheKey = `anilist:schedule:v1:${startTimestampSeconds}:${endTimestampSeconds}`;

  const data = await gql<{
    Page: {
      airingSchedules: Array<{
        id: number;
        episode: number;
        airingAt: number;
        media: AniListMedia;
      }>;
    };
  }>(
    cacheKey,
    `query ($start: Int, $end: Int) {
      Page(page: 1, perPage: 50) {
        airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: [TIME]) {
          id
          episode
          airingAt
          media {
            id
            idMal
            title { romaji english }
            format
            countryOfOrigin
            isAdult
            coverImage { large extraLarge }
            bannerImage
          }
        }
      }
    }`,
    { start: startTimestampSeconds, end: endTimestampSeconds }
  );

  const seen = new Set<string>();
  const list: AiringScheduleEntry[] = [];

  for (const s of data.Page?.airingSchedules ?? []) {
    const m = s.media;
    if (!m || m.countryOfOrigin !== "JP" || m.isAdult || m.format === "MUSIC") {
      continue;
    }
    const key = `${m.id}-${s.episode}`;
    if (seen.has(key)) continue;
    seen.add(key);

    list.push({
      id: s.id,
      anime_id: m.id,
      title_english: m.title?.english ?? null,
      title_romaji: m.title?.romaji ?? null,
      episode: s.episode,
      airing_at: s.airingAt,
      cover_image: m.coverImage?.extraLarge ?? m.coverImage?.large ?? null,
      banner_image: m.bannerImage ?? null,
      format: (m.format as AnimeFormat) ?? null
    });
  }

  return list;
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

export interface EpisodeMediaItem {
  thumbnail: string | null;
  title: string | null;
  air_date: string | null;
}

function parseRomanNumeral(str: string): number | null {
  const m = /\b(X|IX|VIII|VII|VI|V|IV|III|II|I)\b/i.exec(str);
  if (!m?.[1]) return null;
  const map: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };
  return map[m[1].toUpperCase()] ?? null;
}

function detectSeasonNumber(title: string | null | undefined): number | null {
  if (!title) return null;
  const sMatch = /season\s*(\d+)/i.exec(title);
  if (sMatch?.[1]) return parseInt(sMatch[1], 10);
  const nthMatch = /(\d+)(?:nd|rd|th|st)\s*season/i.exec(title);
  if (nthMatch?.[1]) return parseInt(nthMatch[1], 10);
  const roman = parseRomanNumeral(title);
  if (roman && roman > 1) return roman;
  return null;
}

/** Per-episode thumbnails + official titles + release dates.
 * 1. AniList streamingEpisodes (Crunchyroll titles & thumbnails).
 * 2. TVMaze (official episode titles & airdates for the matching season).
 * 3. Jikan fallback for MAL video stills.
 * 4. Fallback weekly calculated dates based on anime premiere date. */
export async function getEpisodeMedia(
  id: number,
  malId: number | null = null,
  animeTitle?: string | null,
  startDate?: string | null,
  seasonYear?: number | null,
  episodeCount?: number | null
): Promise<Map<number, EpisodeMediaItem>> {
  const cacheKey = `anilist:epmedia:v6:${id}`;
  const cached = await getCached<Array<[number, EpisodeMediaItem]>>(cacheKey).catch(() => undefined);
  if (cached !== undefined && cached.length > 0) {
    return new Map(cached);
  }

  const map = new Map<number, EpisodeMediaItem>();

  // 1. AniList streamingEpisodes
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
          title: raw.title ? raw.title.replace(/^episode\s*\d+\s*[-–—:]\s*/i, "").trim() : null,
          air_date: null
        });
      }
    }
  } catch {
    // continue
  }

  // 2. TVMaze (official titles, release dates, and image stills for the matching season)
  if (animeTitle) {
    try {
      const cleanTitle = animeTitle
        .replace(/\s+(season\s*\d+|part\s*\d+|2nd|3rd|[4-9]th|final\s*season|\b(X|IX|VIII|VII|VI|V|IV|III|II)\b).*/i, "")
        .trim();
      const res = await fetch(
        `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(cleanTitle)}&embed=episodes`,
        { signal: AbortSignal.timeout(4000) }
      );
      if (res.ok) {
        interface TVMazeEp {
          name: string | null;
          season: number;
          number: number | null;
          airdate: string | null;
          image: { original?: string | null; medium?: string | null } | null;
        }
        const payload = (await res.json()) as { _embedded?: { episodes?: TVMazeEp[] } };
        const tvEps = payload._embedded?.episodes ?? [];
        if (tvEps.length > 0) {
          const allSeasons = [...new Set(tvEps.map((e) => e.season))];
          const isYearSeasons = allSeasons.every((s) => s >= 1900);
          const startYear = startDate ? parseInt(startDate.split("-")[0] ?? "0", 10) : (seasonYear ?? null);
          const detectedSeason = detectSeasonNumber(animeTitle);

          let selectedEps: TVMazeEp[] = [];
          if (isYearSeasons) {
            // E.g. Naruto (2002-2007) — single continuous long-running anime
            selectedEps = tvEps;
          } else {
            // Multi-season show (e.g. Mushoku Tensei, Attack on Titan, etc.)
            let targetSeason: number | null = null;
            if (detectedSeason !== null && allSeasons.includes(detectedSeason)) {
              targetSeason = detectedSeason;
            } else if (startYear) {
              const matchSeason = allSeasons.find((s) => {
                const sEps = tvEps.filter((e) => e.season === s && e.airdate);
                return sEps.some((e) => {
                  const y = e.airdate ? parseInt(e.airdate.slice(0, 4), 10) : 0;
                  return Math.abs(y - startYear) <= 1;
                });
              });
              if (matchSeason !== undefined) {
                targetSeason = matchSeason;
              }
            }
            if (targetSeason === null && detectedSeason === null) {
              targetSeason = 1;
            }

            if (targetSeason !== null) {
              selectedEps = tvEps.filter((e) => e.season === targetSeason);
            }
          }

          if (selectedEps.length > 0) {
            // Find best starting episode offset based on startDate (for Part 2 / split-cour)
            let startIndex = 0;
            if (startDate) {
              const targetTime = new Date(startDate).getTime();
              let minDiff = Infinity;
              let bestIdx = 0;
              for (let idx = 0; idx < selectedEps.length; idx += 1) {
                const ep = selectedEps[idx];
                if (ep?.airdate) {
                  const epTime = new Date(ep.airdate).getTime();
                  const diff = Math.abs(epTime - targetTime);
                  if (diff < minDiff && diff <= 30 * 24 * 3600 * 1000) {
                    minDiff = diff;
                    bestIdx = idx;
                  }
                }
              }
              if (minDiff < Infinity) {
                startIndex = bestIdx;
              }
            }

            const totalNeeded = episodeCount ?? (selectedEps.length - startIndex);
            for (let n = 1; n <= totalNeeded; n += 1) {
              const ep = selectedEps[startIndex + n - 1];
              if (!ep) continue;
              const existing = map.get(n);
              const thumb = existing?.thumbnail ?? ep.image?.original ?? ep.image?.medium ?? null;
              const title = existing?.title ?? ep.name ?? null;
              const airDate = existing?.air_date ?? ep.airdate ?? null;
              map.set(n, { thumbnail: thumb, title, air_date: airDate });
            }
          }
        }
      }
    } catch {
      // continue
    }
  }

  // 3. Fallback Jikan MAL video stills
  if (map.size === 0 && malId !== null) {
    const jikanCacheKey = `jikan:epthumbs:${malId}`;
    try {
      interface JikanEpVideo {
        episode: string | null;
        title: string | null;
        images: { jpg: { image_url: string | null } } | null;
      }
      const collected: JikanEpVideo[] = [];
      for (let page = 1; page <= 2; page += 1) {
        const res = await fetch(`https://api.jikan.moe/v4/anime/${malId}/videos/episodes?page=${page}`, {
          signal: AbortSignal.timeout(3500)
        });
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
        if (num > 0) {
          const existing = map.get(num);
          map.set(num, {
            thumbnail: ep.images?.jpg?.image_url ?? existing?.thumbnail ?? null,
            title: ep.title ?? existing?.title ?? null,
            air_date: existing?.air_date ?? null
          });
        }
      }
    } catch {
      // continue
    }
  }

  // 4. Fill in weekly estimated air_date if anime has start_date and episode lacks official air_date
  if (startDate) {
    const parts = startDate.split("-");
    const p0 = parts[0];
    const p1 = parts[1];
    const p2 = parts[2];
    if (p0 && p1 && p2) {
      const baseDate = new Date(parseInt(p0, 10), parseInt(p1, 10) - 1, parseInt(p2, 10));
      if (!isNaN(baseDate.getTime())) {
        for (const [num, item] of map.entries()) {
          if (!item.air_date) {
            const epDate = new Date(baseDate);
            epDate.setDate(epDate.getDate() + (num - 1) * 7);
            item.air_date = epDate.toISOString().slice(0, 10);
          }
        }
      }
    }
  }

  if (map.size > 0) {
    await putCached(cacheKey, [...map.entries()]).catch(() => undefined);
  }
  return map;
}
