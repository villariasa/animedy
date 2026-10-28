// AniList GraphQL client. Server-side only. Throttled ~1 req/700ms.
// See PRD.md §6.

import type {
  AniListMedia,
  AniListMediaResponse,
  AniListSearchResponse,
} from "../interfaces/external.js";
import type { AnimeUpsertInput } from "../interfaces/db.js";
import { createThrottle } from "./throttle.js";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";
const throttle = createThrottle(700);

const MEDIA_FIELDS = `
  id
  idMal
  title { romaji english native }
  synonyms
  format
  status
  season
  seasonYear
  startDate { year month day }
  endDate { year month day }
  episodes
  duration
  description
  coverImage { extraLarge large medium }
  bannerImage
`;

async function graphqlRequest<T>(gqlQuery: string, variables: Record<string, unknown>): Promise<T> {
  return throttle(async () => {
    const res = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: gqlQuery, variables }),
    });
    if (!res.ok) {
      throw new Error(`AniList request failed with status ${res.status}`);
    }
    return (await res.json()) as T;
  });
}

export async function searchAniListMedia(titleQuery: string): Promise<AniListMedia[]> {
  const gqlQuery = `
    query ($search: String) {
      Page(page: 1, perPage: 25) {
        media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  const result = await graphqlRequest<AniListSearchResponse>(gqlQuery, { search: titleQuery });
  return result.data.Page.media;
}

export async function fetchAniListMediaById(
  anilistId: number,
  includeRelations = false,
): Promise<AniListMedia> {
  const relationsFragment = includeRelations
    ? `
      relations {
        edges {
          relationType
          node { ${MEDIA_FIELDS} }
        }
      }
    `
    : "";
  const gqlQuery = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        ${MEDIA_FIELDS}
        ${relationsFragment}
      }
    }
  `;
  const result = await graphqlRequest<AniListMediaResponse>(gqlQuery, { id: anilistId });
  return result.data.Media;
}

function fuzzyDateToIso(date: { year: number | null; month: number | null; day: number | null }): string | null {
  if (!date.year) {
    return null;
  }
  const month = String(date.month ?? 1).padStart(2, "0");
  const day = String(date.day ?? 1).padStart(2, "0");
  return `${date.year}-${month}-${day}`;
}

/**
 * Maps a raw AniList media node to the internal `anime` upsert shape.
 * franchise_key / sequence_order / season_label / arc_name are left null
 * here; the franchise walker (utils/franchise.ts) fills those in.
 */
export function mapAniListMediaToAnimeInput(media: AniListMedia): AnimeUpsertInput {
  return {
    anilist_id: media.id,
    mal_id: media.idMal,
    title_romaji: media.title.romaji,
    title_english: media.title.english,
    title_native: media.title.native,
    synonyms: media.synonyms ?? null,
    format: (media.format as AnimeUpsertInput["format"]) ?? null,
    status: (media.status as AnimeUpsertInput["status"]) ?? null,
    season: (media.season as AnimeUpsertInput["season"]) ?? null,
    season_year: media.seasonYear,
    start_date: fuzzyDateToIso(media.startDate),
    end_date: fuzzyDateToIso(media.endDate),
    episode_count: media.episodes,
    episode_duration: media.duration,
    description: media.description,
    cover_image: media.coverImage.extraLarge ?? media.coverImage.large ?? media.coverImage.medium,
    banner_image: media.bannerImage,
    franchise_key: null,
    sequence_order: null,
    season_label: null,
    arc_name: null,
    metadata_json: media as unknown as Record<string, unknown>,
  };
}
