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

class LikesStore {
  items = $state<LikedAnime[]>([]);

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
    const idx = this.items.findIndex((item) => item.anime_id === anime.anime_id);
    if (idx >= 0) {
      this.items = this.items.filter((item) => item.anime_id !== anime.anime_id);
      this.persist();
      return false;
    } else {
      this.items = [
        {
          anime_id: anime.anime_id,
          title_english: anime.title_english ?? null,
          title_romaji: anime.title_romaji ?? null,
          cover_image: anime.cover_image ?? null,
          format: anime.format ?? null,
          season_year: anime.season_year ?? null,
          liked_at: new Date().toISOString()
        },
        ...this.items
      ];
      this.persist();
      return true;
    }
  }

  get count(): number {
    return this.items.length;
  }
}

export const likes = new LikesStore();
