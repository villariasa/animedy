export type WatchStatus = "watching" | "completed" | "plan_to_watch" | "dropped";

export const WATCH_STATUS_LABELS: Record<WatchStatus, string> = {
  watching: "Watching",
  completed: "Completed",
  plan_to_watch: "Plan to Watch",
  dropped: "Dropped"
};

export const WATCH_STATUS_ORDER: WatchStatus[] = ["watching", "plan_to_watch", "completed", "dropped"];

export interface WatchStatusEntry {
  anime_id: number;
  status: WatchStatus;
  title_english: string | null;
  title_romaji: string | null;
  cover_image: string | null;
  format?: string | null;
  season_year?: number | null;
  updated_at: string;
}

export const WATCH_STATUS_STORAGE_KEY = "animedy.watch_status";
const STORAGE_KEY = WATCH_STATUS_STORAGE_KEY;

export interface WatchStatusAction {
  /** The entry as it looked right before this action (for undo). */
  previous: WatchStatusEntry | null;
  /** The entry as it looks after this action (null if cleared). */
  current: WatchStatusEntry | null;
  at: number;
}

class WatchStatusStore {
  items = $state<WatchStatusEntry[]>([]);
  /** Last set/clear, consumed by the global undo snackbar. */
  lastAction = $state<WatchStatusAction | null>(null);

  constructor() {
    this.restore();
  }

  restore(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.items = JSON.parse(raw) as WatchStatusEntry[];
      }
    } catch {
      this.items = [];
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
    } catch {
      // storage quota or disabled
    }
  }

  getStatus(animeId: number): WatchStatus | null {
    return this.items.find((item) => item.anime_id === animeId)?.status ?? null;
  }

  setStatus(
    anime: {
      anime_id: number;
      title_english?: string | null;
      title_romaji?: string | null;
      cover_image?: string | null;
      format?: string | null;
      season_year?: number | null;
    },
    status: WatchStatus
  ): void {
    const previous = this.items.find((item) => item.anime_id === anime.anime_id) ?? null;
    const rest = this.items.filter((item) => item.anime_id !== anime.anime_id);
    const entry: WatchStatusEntry = {
      anime_id: anime.anime_id,
      status,
      title_english: anime.title_english ?? null,
      title_romaji: anime.title_romaji ?? null,
      cover_image: anime.cover_image ?? null,
      format: anime.format ?? null,
      season_year: anime.season_year ?? null,
      updated_at: new Date().toISOString()
    };
    this.items = [entry, ...rest];
    this.persist();
    this.lastAction = { previous, current: entry, at: Date.now() };
  }

  clearStatus(animeId: number): void {
    const previous = this.items.find((item) => item.anime_id === animeId) ?? null;
    this.items = this.items.filter((item) => item.anime_id !== animeId);
    this.persist();
    if (previous) {
      this.lastAction = { previous, current: null, at: Date.now() };
    }
  }

  /** Reverse the last set/clear. */
  undo(): void {
    const action = this.lastAction;
    if (!action) return;
    const animeId = (action.current ?? action.previous)?.anime_id;
    if (animeId === undefined) return;
    const rest = this.items.filter((item) => item.anime_id !== animeId);
    if (action.previous) {
      this.items = [action.previous, ...rest];
    } else {
      this.items = rest;
    }
    this.persist();
    this.lastAction = { previous: action.current, current: action.previous, at: Date.now() };
  }

  dismissUndo(): void {
    this.lastAction = null;
  }

  byStatus(status: WatchStatus): WatchStatusEntry[] {
    return this.items
      .filter((item) => item.status === status)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  countFor(status: WatchStatus): number {
    return this.items.filter((item) => item.status === status).length;
  }

  get count(): number {
    return this.items.length;
  }
}

export const watchStatusStore = new WatchStatusStore();
