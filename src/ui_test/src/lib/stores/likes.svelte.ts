export interface LikedAnime {
  anime_id: number;
  title_english: string | null;
  title_romaji: string | null;
  cover_image: string | null;
  format?: string | null;
  season_year?: number | null;
  liked_at: string;
}

const STORAGE_KEY = "animedy.liked_animes";

export interface LikeAction {
  type: "liked" | "unliked";
  item: LikedAnime;
  at: number;
}

class LikesStore {
  items = $state<LikedAnime[]>([]);
  /** Last like/unlike, consumed by the global undo snackbar. */
  lastAction = $state<LikeAction | null>(null);

  constructor() {
    this.restore();
  }

  restore(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.items = JSON.parse(raw) as LikedAnime[];
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

  isLiked(animeId: number): boolean {
    return this.items.some((item) => item.anime_id === animeId);
  }

  toggleLike(anime: {
    anime_id: number;
    title_english?: string | null;
    title_romaji?: string | null;
    cover_image?: string | null;
    format?: string | null;
    season_year?: number | null;
  }): boolean {
    const existing = this.items.find((item) => item.anime_id === anime.anime_id);
    if (existing) {
      this.items = this.items.filter((item) => item.anime_id !== anime.anime_id);
      this.persist();
      this.lastAction = { type: "unliked", item: existing, at: Date.now() };
      return false;
    } else {
      const entry: LikedAnime = {
        anime_id: anime.anime_id,
        title_english: anime.title_english ?? null,
        title_romaji: anime.title_romaji ?? null,
        cover_image: anime.cover_image ?? null,
        format: anime.format ?? null,
        season_year: anime.season_year ?? null,
        liked_at: new Date().toISOString()
      };
      this.items = [entry, ...this.items];
      this.persist();
      this.lastAction = { type: "liked", item: entry, at: Date.now() };
      return true;
    }
  }

  /** Reverse the last like/unlike. The undo is itself undoable, so you can
   * flip back and forth (unlike → undo → it's liked again → undo …). */
  undo(): void {
    const action = this.lastAction;
    if (action) {
      if (action.type === "unliked") {
        // Restore with its original liked_at so it returns to its old spot.
        if (!this.isLiked(action.item.anime_id)) {
          this.items = [action.item, ...this.items];
          this.persist();
        }
        this.lastAction = { type: "liked", item: action.item, at: Date.now() };
      } else {
        this.items = this.items.filter((item) => item.anime_id !== action.item.anime_id);
        this.persist();
        this.lastAction = { type: "unliked", item: action.item, at: Date.now() };
      }
    }
  }

  dismissUndo(): void {
    this.lastAction = null;
  }

  get count(): number {
    return this.items.length;
  }
}

export const likes = new LikesStore();
