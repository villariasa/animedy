import { hasToken, apiPutLike, apiDeleteLike } from "$lib/api/account";

export interface LikedAnime {
  anime_id: number;
  title_english: string | null;
  title_romaji: string | null;
  cover_image: string | null;
  format?: string | null;
  season_year?: number | null;
  liked_at: string;
}

export const LIKES_STORAGE_KEY = "animedy.liked_animes";
const STORAGE_KEY = LIKES_STORAGE_KEY;

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

  /** Write-through to the account API when signed in; local-only for guests.
   * Fire-and-forget — the local copy is already updated optimistically. */
  private syncRemote(entry: LikedAnime, liked: boolean): void {
    if (!hasToken()) return;
    const call = liked
      ? apiPutLike(entry.anime_id, {
          title_english: entry.title_english,
          title_romaji: entry.title_romaji,
          cover_image: entry.cover_image,
          format: entry.format ?? null,
          season_year: entry.season_year ?? null,
          liked_at: entry.liked_at
        })
      : apiDeleteLike(entry.anime_id);
    void call.catch(() => undefined);
  }

  /** Replace local state with the cloud copy (after login/migration). */
  replaceAll(items: LikedAnime[]): void {
    this.items = items;
    this.persist();
  }

  /** Wipe local state (sign-out) so the next guest session starts clean. */
  clearAll(): void {
    this.items = [];
    this.lastAction = null;
    this.persist();
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
      this.syncRemote(existing, false);
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
      this.syncRemote(entry, true);
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
          this.syncRemote(action.item, true);
        }
        this.lastAction = { type: "liked", item: action.item, at: Date.now() };
      } else {
        this.items = this.items.filter((item) => item.anime_id !== action.item.anime_id);
        this.persist();
        this.syncRemote(action.item, false);
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
