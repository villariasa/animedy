// User-named lists (e.g. "Comfort Rewatches", "Isekai Backlog") — separate
// from the fixed Watching/Completed/Plan to Watch/Dropped statuses in
// watchStatus.svelte.ts. An anime can belong to any number of custom lists
// at once (unlike watch status, which is exclusive), so membership is a
// flat array of {list_id, anime_id} rows rather than one field per anime.
// Local-only (localStorage), same as every other store here — no accounts.

export interface CustomList {
  id: string;
  name: string;
  created_at: string;
}

export interface CustomListEntry {
  list_id: string;
  anime_id: number;
  title_english: string | null;
  title_romaji: string | null;
  cover_image: string | null;
  format?: string | null;
  season_year?: number | null;
  added_at: string;
}

export const CUSTOM_LISTS_KEY = "animedy.custom_lists";
export const CUSTOM_LIST_ENTRIES_KEY = "animedy.custom_list_entries";

function makeId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

class CustomListsStore {
  lists = $state<CustomList[]>([]);
  entries = $state<CustomListEntry[]>([]);

  constructor() {
    this.restore();
  }

  restore(): void {
    try {
      const rawLists = localStorage.getItem(CUSTOM_LISTS_KEY);
      this.lists = rawLists ? (JSON.parse(rawLists) as CustomList[]) : [];
    } catch {
      this.lists = [];
    }
    try {
      const rawEntries = localStorage.getItem(CUSTOM_LIST_ENTRIES_KEY);
      this.entries = rawEntries ? (JSON.parse(rawEntries) as CustomListEntry[]) : [];
    } catch {
      this.entries = [];
    }
  }

  private persistLists(): void {
    try {
      localStorage.setItem(CUSTOM_LISTS_KEY, JSON.stringify(this.lists));
    } catch {
      // storage quota or disabled
    }
  }

  private persistEntries(): void {
    try {
      localStorage.setItem(CUSTOM_LIST_ENTRIES_KEY, JSON.stringify(this.entries));
    } catch {
      // storage quota or disabled
    }
  }

  /** Creates a new list and returns its id. Blank/whitespace-only names are rejected. */
  create(name: string): CustomList | null {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const list: CustomList = { id: makeId(), name: trimmed, created_at: new Date().toISOString() };
    this.lists = [...this.lists, list];
    this.persistLists();
    return list;
  }

  rename(listId: string, name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    this.lists = this.lists.map((l) => (l.id === listId ? { ...l, name: trimmed } : l));
    this.persistLists();
  }

  remove(listId: string): void {
    this.lists = this.lists.filter((l) => l.id !== listId);
    this.entries = this.entries.filter((e) => e.list_id !== listId);
    this.persistLists();
    this.persistEntries();
  }

  isInList(listId: string, animeId: number): boolean {
    return this.entries.some((e) => e.list_id === listId && e.anime_id === animeId);
  }

  /** All custom lists a given anime currently belongs to. */
  listsContaining(animeId: number): CustomList[] {
    const ids = new Set(this.entries.filter((e) => e.anime_id === animeId).map((e) => e.list_id));
    return this.lists.filter((l) => ids.has(l.id));
  }

  addAnime(
    listId: string,
    anime: {
      anime_id: number;
      title_english?: string | null;
      title_romaji?: string | null;
      cover_image?: string | null;
      format?: string | null;
      season_year?: number | null;
    }
  ): void {
    if (this.isInList(listId, anime.anime_id)) return;
    const entry: CustomListEntry = {
      list_id: listId,
      anime_id: anime.anime_id,
      title_english: anime.title_english ?? null,
      title_romaji: anime.title_romaji ?? null,
      cover_image: anime.cover_image ?? null,
      format: anime.format ?? null,
      season_year: anime.season_year ?? null,
      added_at: new Date().toISOString()
    };
    this.entries = [entry, ...this.entries];
    this.persistEntries();
  }

  removeAnime(listId: string, animeId: number): void {
    this.entries = this.entries.filter((e) => !(e.list_id === listId && e.anime_id === animeId));
    this.persistEntries();
  }

  toggleAnime(
    listId: string,
    anime: {
      anime_id: number;
      title_english?: string | null;
      title_romaji?: string | null;
      cover_image?: string | null;
      format?: string | null;
      season_year?: number | null;
    }
  ): void {
    if (this.isInList(listId, anime.anime_id)) {
      this.removeAnime(listId, anime.anime_id);
    } else {
      this.addAnime(listId, anime);
    }
  }

  itemsOf(listId: string): CustomListEntry[] {
    return this.entries
      .filter((e) => e.list_id === listId)
      .sort((a, b) => b.added_at.localeCompare(a.added_at));
  }

  countOf(listId: string): number {
    return this.entries.filter((e) => e.list_id === listId).length;
  }
}

export const customLists = new CustomListsStore();
