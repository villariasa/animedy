// Client-side continuation engine — everything comes from IndexedDB progress
// (no accounts, no server): resume an unfinished episode → next episode →
// first episode of the next franchise entry.
import type { ContinueWatchingItem, FranchiseEntry } from "$lib/api/types";
import { getAllLocalProgress, type LocalProgress } from "$lib/db/local";

export interface LocalWatchNext {
  type: "RESUME" | "NEXT_EPISODE" | "NEXT_SEASON";
  anime_id: number;
  episode_number: number;
  season_label?: string | null;
  title?: string | null;
  reason: string;
}

/** Latest progress row per anime, newest first. */
export async function latestProgressByAnime(): Promise<LocalProgress[]> {
  const rows = await getAllLocalProgress().catch(() => []);
  const byAnime = new Map<number, LocalProgress>();
  for (const row of rows) {
    const existing = byAnime.get(row.anime_id);
    if (!existing || row.last_watched_at > existing.last_watched_at) {
      byAnime.set(row.anime_id, row);
    }
  }
  return [...byAnime.values()].sort((a, b) => b.last_watched_at.localeCompare(a.last_watched_at));
}

/** Continue Watching rail items from local progress (incomplete first). */
export async function getContinueWatching(limit = 12): Promise<ContinueWatchingItem[]> {
  const latest = await latestProgressByAnime();
  return latest
    .filter((row) => !row.completed || row.position_seconds > 0)
    .slice(0, limit)
    .map((row) => {
      const duration = row.duration_seconds > 0 ? row.duration_seconds : 0;
      const percent = duration > 0 ? (row.position_seconds / duration) * 100 : 0;
      return {
        franchise_key: String(row.anime_id),
        anime_id: row.anime_id,
        title_romaji: row.title_romaji ?? null,
        title_english: row.title_english ?? null,
        season_label: null,
        episode_id: row.episode_number ?? 1,
        episode_number: row.episode_number ?? 1,
        progress_percent: row.completed ? 100 : percent,
        remaining_seconds: row.completed ? 0 : Math.max(0, duration - row.position_seconds),
        last_watched_at: row.last_watched_at
      };
    });
}

/** What to watch next within one anime/franchise, from local progress only. */
export async function getLocalWatchNext(
  animeId: number,
  episodeCount: number | null,
  franchise: FranchiseEntry[]
): Promise<LocalWatchNext | null> {
  let result: LocalWatchNext | null = null;
  const rows = (await getAllLocalProgress().catch(() => [])).filter((r) => r.anime_id === animeId);
  rows.sort((a, b) => b.last_watched_at.localeCompare(a.last_watched_at));
  const latest = rows[0];

  if (latest) {
    const epNum = latest.episode_number ?? 1;
    if (!latest.completed && latest.position_seconds > 0) {
      result = {
        type: "RESUME",
        anime_id: animeId,
        episode_number: epNum,
        reason: "Pick up where you left off"
      };
    } else if (episodeCount === null || epNum < episodeCount) {
      result = {
        type: "NEXT_EPISODE",
        anime_id: animeId,
        episode_number: epNum + 1,
        reason: "Next episode in this series"
      };
    } else {
      // Series finished → first episode of the next franchise entry.
      const index = franchise.findIndex((f) => f.anime_id === animeId);
      const next = index >= 0 ? franchise[index + 1] : undefined;
      if (next) {
        result = {
          type: "NEXT_SEASON",
          anime_id: next.anime_id,
          episode_number: 1,
          season_label: next.season_label,
          title: next.title_english ?? next.title_romaji,
          reason: "Continue the franchise"
        };
      }
    }
  }
  return result;
}
