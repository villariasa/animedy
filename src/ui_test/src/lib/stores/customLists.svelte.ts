// User-named lists (e.g. "Comfort Rewatches", "Isekai Backlog") — separate
// from the fixed Watching/Completed/Plan to Watch/Dropped statuses in
// watchStatus.svelte.ts. An anime can belong to any number of custom lists
// at once (unlike watch status, which is exclusive), so membership is a
// flat array of {list_id, anime_id} rows rather than one field per anime.
// Guest mode uses localStorage only; when signed in, writes also go through
// the account API. Cloud list ids are numeric — the local string `id` holds
// the stringified server id once synced ("42"); guest-created lists keep a
// random temp id until migration remaps them.

import {
  hasToken,
  apiCreateList,
  apiRenameList,
  apiDeleteList,
  apiAddListEntry,
  apiRemoveListEntry
} from "$lib/api/account";

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

  /** Cloud list ids are numeric strings; guest temp ids are not. */
  private static isCloudId(listId: string): boolean {
    return /^\d+$/.test(listId);
  }

  /** Swap a temp id for the server-assigned one across lists and entries. */
  private remapId(fromId: string, toId: string): void {
    this.lists = this.lists.map((l) => (l.id === fromId ? { ...l, id: toId } : l));
    this.entries = this.entries.map((e) => (e.list_id === fromId ? { ...e, list_id: toId } : e));
    this.persistLists();
    this.persistEntries();
  }

  /** Creates a new list and returns its id. Blank/whitespace-only names are rejected. */
  create(name: string): CustomList | null {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const list: CustomList = { id: makeId(), name: trimmed, created_at: new Date().toISOString() };
    this.lists = [...this.lists, list];
    this.persistLists();
    if (hasToken()) {
      void apiCreateList(trimmed)
        .then((created) => this.remapId(list.id, String(created.id)))
        .catch(() => undefined);
    }
    return list;
  }

  rename(listId: string, name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    this.lists = this.lists.map((l) => (l.id === listId ? { ...l, name: trimmed } : l));
    this.persistLists();
    if (hasToken() && CustomListsStore.isCloudId(listId)) {
      void apiRenameList(Number(listId), trimmed).catch(() => undefined);
    }
  }

  remove(listId: string): void {
    this.lists = this.lists.filter((l) => l.id !== listId);
    this.entries = this.entries.filter((e) => e.list_id !== listId);
    this.persistLists();
    this.persistEntries();
    if (hasToken() && CustomListsStore.isCloudId(listId)) {
      void apiDeleteList(Number(listId)).catch(() => undefined);
    }
  }

  /** Replace local state with the cloud copy (after login/migration). */
  replaceAll(lists: CustomList[], entries: CustomListEntry[]): void {
    this.lists = lists;
    this.entries = entries;
    this.persistLists();
    this.persistEntries();
  }

  /** Wipe local state (sign-out). */
  clearAll(): void {
    this.lists = [];
    this.entries = [];
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
    if (hasToken() && CustomListsStore.isCloudId(listId)) {
      void apiAddListEntry(Number(listId), entry.anime_id, {
        title_english: entry.title_english,
        title_romaji: entry.title_romaji,
        cover_image: entry.cover_image,
        format: entry.format ?? null,
        season_year: entry.season_year ?? null,
        added_at: entry.added_at
      }).catch(() => undefined);
    }
  }

  removeAnime(listId: string, animeId: number): void {
    this.entries = this.entries.filter((e) => !(e.list_id === listId && e.anime_id === animeId));
    this.persistEntries();
    if (hasToken() && CustomListsStore.isCloudId(listId)) {
      void apiRemoveListEntry(Number(listId), animeId).catch(() => undefined);
    }
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
