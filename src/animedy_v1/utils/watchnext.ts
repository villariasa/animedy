// Continuation engine: priority order per PRD §9 —
// (1) resume unfinished current episode
// (2) next episode in current anime
// (3) next season/part in franchise
// (4) official sequel series
// (5) required movie in sequence
// (6) special/OVA
// (7) franchise completed -> recommendation (first unwatched related entry)

import { query } from "../../lib/dbconn.js";
import type { AnimeRow, EpisodeRow, WatchProgressRow, WatchStateRow } from "../interfaces/db.js";
import type {
  WatchNextAnimeSummary,
  WatchNextEpisodeSummary,
  WatchNextGetResponse,
  WatchNextType,
} from "../interfaces/api.js";
import { SELECT_NEXT_FRANCHISE_ENTRY, SELECT_RELATED_RECOMMENDATIONS } from "../queries/anime.js";
import {
  SELECT_EPISODE_BY_ID,
  SELECT_FIRST_EPISODE_OF_ANIME,
  SELECT_NEXT_EPISODE,
} from "../queries/episodes.js";
import {
  SELECT_USER_HAS_WATCHED_ANIME,
  SELECT_WATCH_PROGRESS,
  SELECT_WATCH_STATE_BY_USER_AND_FRANCHISE,
} from "../queries/progress.js";
import { getAnimeRowById } from "./metadata.js";

interface RelatedCandidate extends AnimeRow {
  relation_type: string;
}

function toAnimeSummary(anime: AnimeRow): WatchNextAnimeSummary {
  return {
    anime_id: anime.id,
    title_romaji: anime.title_romaji,
    title_english: anime.title_english,
    format: anime.format,
    season_label: anime.season_label,
  };
}

function toEpisodeSummary(episode: EpisodeRow, resumePositionSeconds = 0): WatchNextEpisodeSummary {
  return {
    episode_id: episode.id,
    episode_number: episode.episode_number,
    title: episode.title,
    resume_position_seconds: resumePositionSeconds,
  };
}

// Strips season/part markers so "Attack on Titan Season 2" and
// "Attack on Titan Season 3" are recognized as the same base title, while a
// genuinely distinct sequel series title (e.g. "Boruto") is not.
function titleRoot(title: string | null): string {
  return (title ?? "")
    .toLowerCase()
    .replace(/final season/g, "")
    .replace(/season\s*\d+/g, "")
    .replace(/part\s*\d+/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function classifyFranchiseStep(current: AnimeRow, next: AnimeRow): WatchNextType {
  if (next.format === "MOVIE") {
    return "MOVIE";
  }
  if (next.format === "SPECIAL" || next.format === "OVA" || next.format === "ONA" || next.format === "TV_SHORT") {
    return "SPECIAL_OR_OVA";
  }
  const currentRoot = titleRoot(current.title_romaji ?? current.title_english);
  const nextRoot = titleRoot(next.title_romaji ?? next.title_english);
  return currentRoot && currentRoot === nextRoot ? "NEXT_SEASON" : "SEQUEL";
}

async function tryContinueCurrentState(
  userId: number,
  state: WatchStateRow,
): Promise<WatchNextGetResponse | null> {
  if (!state.current_episode_id || !state.current_anime_id) {
    return null;
  }

  const [currentEpisode] = await query<EpisodeRow[]>(SELECT_EPISODE_BY_ID, [state.current_episode_id]);
  const currentAnime = await getAnimeRowById(state.current_anime_id);
  if (!currentEpisode || !currentAnime) {
    return null;
  }

  // Priority 1: resume unfinished current episode.
  const [progress] = await query<WatchProgressRow[]>(SELECT_WATCH_PROGRESS, [
    userId,
    state.current_episode_id,
  ]);
  if (progress && progress.completed === 0 && progress.position_seconds > 0) {
    return {
      type: "RESUME",
      anime: toAnimeSummary(currentAnime),
      episode: toEpisodeSummary(currentEpisode, progress.position_seconds),
      reason: "Resuming the current episode in progress",
    };
  }

  // Priority 2: next episode within the same anime.
  const [nextEpisode] = await query<EpisodeRow[]>(SELECT_NEXT_EPISODE, [
    currentAnime.id,
    currentEpisode.episode_number,
  ]);
  if (nextEpisode) {
    return {
      type: "NEXT_EPISODE",
      anime: toAnimeSummary(currentAnime),
      episode: toEpisodeSummary(nextEpisode),
      reason: "Next episode in the current series",
    };
  }

  // Priority 3-6: next franchise entry by sequence_order (season/part,
  // sequel series, movie, or special/OVA — classified by format + title).
  if (currentAnime.sequence_order !== null && currentAnime.franchise_key) {
    const [nextAnime] = await query<AnimeRow[]>(SELECT_NEXT_FRANCHISE_ENTRY, [
      currentAnime.franchise_key,
      currentAnime.sequence_order,
    ]);
    if (nextAnime) {
      const [firstEpisode] = await query<EpisodeRow[]>(SELECT_FIRST_EPISODE_OF_ANIME, [nextAnime.id]);
      const type = classifyFranchiseStep(currentAnime, nextAnime);
      return {
        type,
        anime: toAnimeSummary(nextAnime),
        episode: firstEpisode ? toEpisodeSummary(firstEpisode) : null,
        reason: `Continuing the franchise (${type.toLowerCase().replace("_", " ")})`,
      };
    }
  }

  return null;
}

async function tryRecommendation(
  userId: number,
  anchorAnimeId: number | null,
): Promise<WatchNextGetResponse | null> {
  if (!anchorAnimeId) {
    return null;
  }
  const candidates = await query<RelatedCandidate[]>(SELECT_RELATED_RECOMMENDATIONS, [anchorAnimeId]);
  for (const candidate of candidates) {
    const [watchedCount] = await query<{ total: number }[]>(SELECT_USER_HAS_WATCHED_ANIME, [
      userId,
      candidate.id,
    ]);
    if ((watchedCount?.total ?? 0) === 0) {
      const [firstEpisode] = await query<EpisodeRow[]>(SELECT_FIRST_EPISODE_OF_ANIME, [candidate.id]);
      return {
        type: "RECOMMENDATION",
        anime: toAnimeSummary(candidate),
        episode: firstEpisode ? toEpisodeSummary(firstEpisode) : null,
        reason: `Franchise completed; recommended related title (${candidate.relation_type})`,
      };
    }
  }
  return null;
}

/**
 * Computes the next recommended watch action for a user within a franchise,
 * following the priority order documented above.
 */
export async function computeWatchNext(userId: number, franchiseKey: string): Promise<WatchNextGetResponse> {
  const [state] = await query<WatchStateRow[]>(SELECT_WATCH_STATE_BY_USER_AND_FRANCHISE, [
    userId,
    franchiseKey,
  ]);

  if (state && !state.franchise_completed) {
    const continued = await tryContinueCurrentState(userId, state);
    if (continued) {
      return continued;
    }
  }

  const recommendation = await tryRecommendation(userId, state?.current_anime_id ?? null);
  if (recommendation) {
    return recommendation;
  }

  return { type: "NONE", anime: null, episode: null, reason: "No further content available" };
}
