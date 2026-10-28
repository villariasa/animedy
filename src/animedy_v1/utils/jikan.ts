// Jikan (MyAnimeList) REST client. Server-side only. Throttled ~1 req/400ms.
// Fallback/alternate metadata source, mapped to the same `anime` cache shape.
// See PRD.md §6.

import type { AnimeUpsertInput } from "../interfaces/db.js";
import type { JikanAnimeData, JikanAnimeDetailsResponse, JikanSearchResponse } from "../interfaces/external.js";
import { createThrottle } from "./throttle.js";

const JIKAN_BASE = "https://api.jikan.moe/v4";
const throttle = createThrottle(400);

async function jikanGet<T>(path: string): Promise<T> {
  return throttle(async () => {
    const res = await fetch(`${JIKAN_BASE}${path}`, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      throw new Error(`Jikan request failed with status ${res.status}`);
    }
    return (await res.json()) as T;
  });
}

export async function searchJikanAnime(titleQuery: string): Promise<JikanAnimeData[]> {
  const result = await jikanGet<JikanSearchResponse>(`/anime?q=${encodeURIComponent(titleQuery)}&limit=25`);
  return result.data;
}

export async function fetchJikanAnimeById(malId: number): Promise<JikanAnimeData> {
  const result = await jikanGet<JikanAnimeDetailsResponse>(`/anime/${malId}/full`);
  return result.data;
}

const FORMAT_MAP: Record<string, AnimeUpsertInput["format"]> = {
  TV: "TV",
  Movie: "MOVIE",
  OVA: "OVA",
  ONA: "ONA",
  Special: "SPECIAL",
  "TV Special": "SPECIAL",
  "TV Short": "TV_SHORT",
  Music: "MUSIC",
};

const STATUS_MAP: Record<string, AnimeUpsertInput["status"]> = {
  "Finished Airing": "FINISHED",
  "Currently Airing": "RELEASING",
  "Not yet aired": "NOT_YET_RELEASED",
};

const SEASON_MAP: Record<string, AnimeUpsertInput["season"]> = {
  winter: "WINTER",
  spring: "SPRING",
  summer: "SUMMER",
  fall: "FALL",
};

function toDateOnly(value: string | null): string | null {
  if (!value) {
    return null;
  }
  return value.slice(0, 10);
}

function pickTitle(data: JikanAnimeData, type: string): string | null {
  const match = data.titles.find((entry) => entry.type === type);
  return match ? match.title : null;
}

/**
 * Maps a raw Jikan anime payload to the internal `anime` upsert shape.
 * anilist_id is always null here (AniList is the primary metadata source
 * for the franchise relation graph); mal_id is set.
 */
export function mapJikanAnimeToAnimeInput(data: JikanAnimeData): AnimeUpsertInput {
  return {
    anilist_id: null,
    mal_id: data.mal_id,
    title_romaji: pickTitle(data, "Default") ?? pickTitle(data, "Japanese"),
    title_english: pickTitle(data, "English"),
    title_native: pickTitle(data, "Japanese"),
    synonyms: data.titles.filter((entry) => entry.type === "Synonym").map((entry) => entry.title),
    format: data.type ? FORMAT_MAP[data.type] ?? null : null,
    status: data.status ? STATUS_MAP[data.status] ?? null : null,
    season: data.season ? SEASON_MAP[data.season.toLowerCase()] ?? null : null,
    season_year: data.year,
    start_date: toDateOnly(data.aired.from),
    end_date: toDateOnly(data.aired.to),
    episode_count: data.episodes,
    episode_duration: null,
    description: data.synopsis,
    cover_image: data.images.jpg.large_image_url ?? data.images.jpg.image_url,
    banner_image: null,
    franchise_key: null,
    sequence_order: null,
    season_label: null,
    arc_name: null,
    metadata_json: data as unknown as Record<string, unknown>,
  };
}
