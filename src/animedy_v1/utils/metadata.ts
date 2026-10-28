// Metadata fallback-chain orchestration: selected source -> other source ->
// stale cache. See PRD.md §6. Also hosts the shared anime upsert helper used
// by anilist.ts / jikan.ts mappings and by the franchise walker.

import { query } from "../../lib/dbconn.js";
import { logError } from "../../lib/errorlogger.js";
import type { AnimeRow, AnimeUpsertInput, MetadataSource } from "../interfaces/db.js";
import {
  INSERT_ANIME,
  SELECT_ANIME_BY_ANILIST_ID,
  SELECT_ANIME_BY_ID,
  SELECT_ANIME_BY_MAL_ID,
  UPDATE_ANIME_BY_ID,
} from "../queries/anime.js";
import { fetchAniListMediaById, mapAniListMediaToAnimeInput } from "./anilist.js";
import { fetchJikanAnimeById, mapJikanAnimeToAnimeInput } from "./jikan.js";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export class MetadataFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetadataFetchError";
  }
}

export function isCacheFresh(cachedAt: string | null): boolean {
  if (!cachedAt) {
    return false;
  }
  return Date.now() - new Date(cachedAt).getTime() < CACHE_TTL_MS;
}

export async function getAnimeRowById(animeId: number): Promise<AnimeRow | null> {
  const [row] = await query<AnimeRow[]>(SELECT_ANIME_BY_ID, [animeId]);
  return row ?? null;
}

export async function getAnimeRowByAnilistId(anilistId: number): Promise<AnimeRow | null> {
  const [row] = await query<AnimeRow[]>(SELECT_ANIME_BY_ANILIST_ID, [anilistId]);
  return row ?? null;
}

export async function getAnimeRowByMalId(malId: number): Promise<AnimeRow | null> {
  const [row] = await query<AnimeRow[]>(SELECT_ANIME_BY_MAL_ID, [malId]);
  return row ?? null;
}

/**
 * Upserts a mapped anime input into the cache table. If `anilist_id` is
 * present, relies on the table's unique key for an atomic upsert. If only
 * `mal_id` is present (Jikan-only entries), looks up the existing row by
 * mal_id first and updates it in place to avoid duplicate rows (MySQL
 * allows multiple NULLs in a unique index).
 */
export async function upsertAnimeInput(input: AnimeUpsertInput): Promise<AnimeRow> {
  const cachedAt = new Date().toISOString().slice(0, 19).replace("T", " ");
  const metadataJson = input.metadata_json ? JSON.stringify(input.metadata_json) : null;
  const synonymsJson = input.synonyms ? JSON.stringify(input.synonyms) : null;

  if (input.anilist_id !== null) {
    await query(INSERT_ANIME, [
      input.anilist_id,
      input.mal_id,
      input.title_romaji,
      input.title_english,
      input.title_native,
      synonymsJson,
      input.format,
      input.status,
      input.season,
      input.season_year,
      input.start_date,
      input.end_date,
      input.episode_count,
      input.episode_duration,
      input.description,
      input.cover_image,
      input.banner_image,
      input.franchise_key,
      input.sequence_order,
      input.season_label,
      input.arc_name,
      metadataJson,
      cachedAt,
    ]);
    const row = await getAnimeRowByAnilistId(input.anilist_id);
    if (!row) {
      throw new MetadataFetchError("Failed to persist anime row after upsert");
    }
    return row;
  }

  if (input.mal_id !== null) {
    const existing = await getAnimeRowByMalId(input.mal_id);
    if (existing) {
      await query(UPDATE_ANIME_BY_ID, [
        input.anilist_id,
        input.mal_id,
        input.title_romaji,
        input.title_english,
        input.title_native,
        synonymsJson,
        input.format,
        input.status,
        input.season,
        input.season_year,
        input.start_date,
        input.end_date,
        input.episode_count,
        input.episode_duration,
        input.description,
        input.cover_image,
        input.banner_image,
        input.franchise_key,
        input.sequence_order,
        input.season_label,
        input.arc_name,
        metadataJson,
        cachedAt,
        existing.id,
      ]);
      const row = await getAnimeRowById(existing.id);
      if (!row) {
        throw new MetadataFetchError("Failed to persist anime row after update");
      }
      return row;
    }

    await query(INSERT_ANIME, [
      null,
      input.mal_id,
      input.title_romaji,
      input.title_english,
      input.title_native,
      synonymsJson,
      input.format,
      input.status,
      input.season,
      input.season_year,
      input.start_date,
      input.end_date,
      input.episode_count,
      input.episode_duration,
      input.description,
      input.cover_image,
      input.banner_image,
      input.franchise_key,
      input.sequence_order,
      input.season_label,
      input.arc_name,
      metadataJson,
      cachedAt,
    ]);
    const row = await getAnimeRowByMalId(input.mal_id);
    if (!row) {
      throw new MetadataFetchError("Failed to persist anime row after insert");
    }
    return row;
  }

  throw new MetadataFetchError("Cannot upsert anime without anilist_id or mal_id");
}

export interface MetadataLookupParams {
  anime_id?: number;
  anilist_id?: number;
}

async function loadCachedRow(params: MetadataLookupParams): Promise<AnimeRow | null> {
  if (params.anime_id !== undefined) {
    return getAnimeRowById(params.anime_id);
  }
  if (params.anilist_id !== undefined) {
    return getAnimeRowByAnilistId(params.anilist_id);
  }
  return null;
}

async function fetchFromAniList(anilistId: number | undefined): Promise<AnimeUpsertInput | null> {
  if (anilistId === undefined) {
    return null;
  }
  const media = await fetchAniListMediaById(anilistId, false);
  return mapAniListMediaToAnimeInput(media);
}

async function fetchFromJikan(malId: number | undefined): Promise<AnimeUpsertInput | null> {
  if (malId === undefined) {
    return null;
  }
  const data = await fetchJikanAnimeById(malId);
  return mapJikanAnimeToAnimeInput(data);
}

/**
 * Resolves an `anime` row applying the PRD §6 fallback chain:
 * selected source -> other source -> stale cache. Throws
 * MetadataFetchError only when no fresh fetch succeeds AND no cache exists.
 */
export async function resolveAnimeRow(
  params: MetadataLookupParams,
  preferredSource: MetadataSource,
  forceRefresh = false,
): Promise<AnimeRow> {
  const cached = await loadCachedRow(params);
  if (cached && !forceRefresh && isCacheFresh(cached.cached_at)) {
    return cached;
  }

  const anilistId = params.anilist_id ?? cached?.anilist_id ?? undefined;
  const malId = cached?.mal_id ?? undefined;
  const sourceOrder: MetadataSource[] =
    preferredSource === "anilist" ? ["anilist", "mal"] : ["mal", "anilist"];

  for (const source of sourceOrder) {
    try {
      const input =
        source === "anilist" ? await fetchFromAniList(anilistId) : await fetchFromJikan(malId);
      if (input) {
        if (cached) {
          input.franchise_key = cached.franchise_key;
          input.sequence_order = cached.sequence_order;
          input.season_label = cached.season_label;
          input.arc_name = cached.arc_name;
        }
        return await upsertAnimeInput(input);
      }
    } catch (err) {
      await logError(`metadata.resolveAnimeRow.${source}`, err);
    }
  }

  if (cached) {
    return cached;
  }

  throw new MetadataFetchError("Unable to fetch anime metadata from any source");
}
