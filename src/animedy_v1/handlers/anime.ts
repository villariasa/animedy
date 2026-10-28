import type { Context } from "hono";
import { query } from "../../lib/dbconn.js";
import { logError } from "../../lib/errorlogger.js";
import { ok, fail } from "../lib/response.js";
import { getOptionalClaims } from "../utils/auth.js";
import {
  animeDetailsSchema,
  animeFranchiseSchema,
  animeRefreshSchema,
  animeSearchSchema,
} from "../schemas/anime.js";
import { SEARCH_ANIME_BY_TITLE, SELECT_FRANCHISE_ENTRIES } from "../queries/anime.js";
import { SELECT_SETTINGS_BY_USER } from "../queries/settings.js";
import { fetchAniListMediaById, mapAniListMediaToAnimeInput, searchAniListMedia, fetchCuratedAniListMedia } from "../utils/anilist.js";
import { mapJikanAnimeToAnimeInput, searchJikanAnime } from "../utils/jikan.js";
import {
  MetadataFetchError,
  getAnimeRowById,
  resolveAnimeRow,
  upsertAnimeInput,
} from "../utils/metadata.js";
import { walkAndPersistFranchise } from "../utils/franchise.js";
import type { AnimeFormat, AnimeStatus, MetadataSource, UserSettingsRow } from "../interfaces/db.js";
import type {
  AnimeDetailsResponse,
  AnimeFranchiseResponse,
  AnimeRefreshResponse,
  AnimeSearchResponse,
  AnimeSearchResultItem,
  FranchiseEntry,
} from "../interfaces/api.js";

interface AnimeSearchCacheRow {
  id: number;
  anilist_id: number | null;
  mal_id: number | null;
  title_romaji: string | null;
  title_english: string | null;
  cover_image: string | null;
  format: AnimeFormat | null;
  status: AnimeStatus | null;
  season_year: number | null;
}

async function resolvePreferredSource(context: Context, override?: MetadataSource): Promise<MetadataSource> {
  if (override) {
    return override;
  }
  const claims = getOptionalClaims(context);
  if (!claims) {
    return "anilist";
  }
  const rows = await query<UserSettingsRow[]>(SELECT_SETTINGS_BY_USER, [claims.user_id]);
  return rows[0]?.metadata_source ?? "anilist";
}

function toSearchResultItem(row: AnimeSearchCacheRow): AnimeSearchResultItem {
  return {
    anime_id: row.id,
    anilist_id: row.anilist_id,
    mal_id: row.mal_id,
    title_romaji: row.title_romaji,
    title_english: row.title_english,
    cover_image: row.cover_image,
    format: row.format,
    status: row.status,
    season_year: row.season_year,
  };
}

export async function animeSearchHandler(context: Context): Promise<Response> {
  try {
    const parsed = animeSearchSchema.safeParse(await context.req.json().catch(() => ({})));
    if (!parsed.success) {
      return context.json(fail("Invalid request body", 422), 422);
    }
    const { query: titleQuery, metadata_source } = parsed.data;
    const source = await resolvePreferredSource(context, metadata_source);

    // Skip DB search for special curated tags
    if (!titleQuery.startsWith(":")) {
      const cachedRows = await query<AnimeSearchCacheRow[]>(SEARCH_ANIME_BY_TITLE, [
        titleQuery,
        titleQuery,
        titleQuery,
      ]).catch(() => [] as AnimeSearchCacheRow[]);
      if (cachedRows.length > 0) {
        const responseData: AnimeSearchResponse = { results: cachedRows.map(toSearchResultItem) };
        return context.json(ok(responseData, "Search results (cache)"), 200);
      }
    }

    const results: AnimeSearchCacheRow[] = [];
    try {
      if (source === "anilist") {
        let mediaList;
        if (titleQuery === ":trending") {
          mediaList = await fetchCuratedAniListMedia("TRENDING_DESC", 20);
        } else if (titleQuery === ":popular") {
          mediaList = await fetchCuratedAniListMedia("POPULARITY_DESC", 20);
        } else if (titleQuery === ":top_rated") {
          mediaList = await fetchCuratedAniListMedia("SCORE_DESC", 20);
        } else if (titleQuery === ":this_week") {
          mediaList = await fetchCuratedAniListMedia("TRENDING_DESC", 20, "RELEASING");
        } else if (titleQuery === ":this_month") {
          mediaList = await fetchCuratedAniListMedia("POPULARITY_DESC", 20, "RELEASING");
        } else {
          mediaList = await searchAniListMedia(titleQuery);
        }

        for (const media of mediaList.slice(0, 25)) {
          try {
            results.push(await upsertAnimeInput(mapAniListMediaToAnimeInput(media)));
          } catch {
            // If DB is offline or upsert fails, return direct shape
            results.push({
              id: media.id,
              anilist_id: media.id,
              mal_id: media.idMal,
              title_romaji: media.title.romaji,
              title_english: media.title.english,
              cover_image: media.coverImage.extraLarge ?? media.coverImage.large ?? media.coverImage.medium,
              format: (media.format as AnimeFormat) ?? null,
              status: (media.status as AnimeStatus) ?? null,
              season_year: media.seasonYear,
            });
          }
        }
      } else {
        const dataList = await searchJikanAnime(titleQuery);
        for (const data of dataList.slice(0, 25)) {
          const mapped = mapJikanAnimeToAnimeInput(data);
          try {
            results.push(await upsertAnimeInput(mapped));
          } catch {
            results.push({
              id: data.mal_id,
              anilist_id: null,
              mal_id: data.mal_id,
              title_romaji: mapped.title_romaji,
              title_english: mapped.title_english,
              cover_image: mapped.cover_image,
              format: mapped.format,
              status: mapped.status,
              season_year: mapped.season_year,
            });
          }
        }
      }
    } catch (err) {
      await logError("anime.search.external", err);
      if (results.length === 0) {
        return context.json(fail("Metadata source unavailable", 502), 502);
      }
    }

    const responseData: AnimeSearchResponse = { results: results.map(toSearchResultItem) };
    return context.json(ok(responseData, "Search results"), 200);
  } catch (err) {
    await logError("anime.search", err);
    return context.json(fail("Internal server error", 500), 500);
  }
}

export async function animeDetailsHandler(context: Context): Promise<Response> {
  try {
    const parsed = animeDetailsSchema.safeParse(await context.req.json().catch(() => ({})));
    if (!parsed.success) {
      return context.json(fail("Invalid request body", 422), 422);
    }
    const source = await resolvePreferredSource(context);
    const row = await resolveAnimeRow(parsed.data, source);
    const responseData: AnimeDetailsResponse = { anime: row };
    return context.json(ok(responseData, "Anime details retrieved"), 200);
  } catch (err) {
    if (err instanceof MetadataFetchError) {
      return context.json(fail(err.message, 502), 502);
    }
    await logError("anime.details", err);
    return context.json(fail("Internal server error", 500), 500);
  }
}

export async function animeFranchiseHandler(context: Context): Promise<Response> {
  try {
    const parsed = animeFranchiseSchema.safeParse(await context.req.json().catch(() => ({})));
    if (!parsed.success) {
      return context.json(fail("Invalid request body", 422), 422);
    }
    const source = await resolvePreferredSource(context);
    const row = await resolveAnimeRow(parsed.data, source);

    let franchiseKey = row.franchise_key;
    if (!franchiseKey) {
      if (!row.anilist_id) {
        return context.json(fail("Franchise graph requires AniList metadata", 422), 422);
      }
      const media = await fetchAniListMediaById(row.anilist_id, true);
      franchiseKey = await walkAndPersistFranchise(media);
    }

    const entries = await query<FranchiseEntry[]>(SELECT_FRANCHISE_ENTRIES, [franchiseKey]);
    const responseData: AnimeFranchiseResponse = { franchise_key: franchiseKey, entries };
    return context.json(ok(responseData, "Franchise graph retrieved"), 200);
  } catch (err) {
    if (err instanceof MetadataFetchError) {
      return context.json(fail(err.message, 502), 502);
    }
    await logError("anime.franchise", err);
    return context.json(fail("Internal server error", 500), 500);
  }
}

export async function animeRefreshHandler(context: Context): Promise<Response> {
  try {
    const parsed = animeRefreshSchema.safeParse(await context.req.json().catch(() => ({})));
    if (!parsed.success) {
      return context.json(fail("Invalid request body", 422), 422);
    }
    const { metadata_source, ...lookup } = parsed.data;
    const source = await resolvePreferredSource(context, metadata_source);
    const row = await resolveAnimeRow(lookup, source, true);

    if (row.anilist_id) {
      try {
        const media = await fetchAniListMediaById(row.anilist_id, true);
        await walkAndPersistFranchise(media);
      } catch (err) {
        await logError("anime.refresh.franchise", err);
      }
    }

    const refreshed = (await getAnimeRowById(row.id)) ?? row;
    const responseData: AnimeRefreshResponse = { anime: refreshed };
    return context.json(ok(responseData, "Anime metadata refreshed"), 200);
  } catch (err) {
    if (err instanceof MetadataFetchError) {
      return context.json(fail(err.message, 502), 502);
    }
    await logError("anime.refresh", err);
    return context.json(fail("Internal server error", 500), 500);
  }
}
