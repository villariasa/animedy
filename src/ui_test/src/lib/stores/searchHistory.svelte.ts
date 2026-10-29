const STORAGE_KEY = "animedy.search_history";
const MAX_ENTRIES = 8;

class SearchHistoryStore {
  items = $state<string[]>([]);

  constructor() {
    this.restore();
  }

  restore(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.items = JSON.parse(raw) as string[];
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

  add(query: string): void {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    const deduped = this.items.filter((q) => q.toLowerCase() !== trimmed.toLowerCase());
    this.items = [trimmed, ...deduped].slice(0, MAX_ENTRIES);
    this.persist();
  }

  remove(query: string): void {
    this.items = this.items.filter((q) => q !== query);
    this.persist();
  }

  clear(): void {
    this.items = [];
    this.persist();
  }
}

export const searchHistory = new SearchHistoryStore();
