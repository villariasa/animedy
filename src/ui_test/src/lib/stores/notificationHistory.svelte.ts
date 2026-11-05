// Persisted log behind the header bell icon — separate from the OS-level
// Notification API (notifications.ts). That API is fire-and-forget and
// only reaches the user if permission was granted; this store is what the
// in-app bell icon reads, so notifications still show up here even if the
// user never granted (or denied) browser notification permission.
export type NotificationType = "announcement" | "episode" | "discovery" | "system";

export interface NotificationEntry {
  /** Dedup key — e.g. "announcement:123", "episode:123:5", "discovery:123:<timestamp>". */
  id: string;
  type: NotificationType;
  anime_id?: number | null;
  url?: string | null;
  title: string;
  message: string;
  cover: string | null;
  created_at: string;
  read: boolean;
}

export const NOTIFICATION_HISTORY_KEY = "animedy.notification_history";
const MAX_ENTRIES = 50;

class NotificationHistoryStore {
  items = $state<NotificationEntry[]>([]);
  private syncStarted = false;

  constructor() {
    this.restore();
  }

  restore(): void {
    try {
      const raw = localStorage.getItem(NOTIFICATION_HISTORY_KEY);
      this.items = raw ? (JSON.parse(raw) as NotificationEntry[]) : [];
    } catch {
      this.items = [];
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(this.items));
    } catch {
      // storage quota or disabled
    }
  }

  /** Fetch latest announcements from server and populate notification history. */
  async syncAnnouncements(): Promise<void> {
    try {
      const res = await fetch("/api/announcements", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { data?: { announcements?: Array<{ id: number; title: string; body: string; created_at: string }> } };
      const list = json?.data?.announcements;
      if (!Array.isArray(list)) return;

      let changed = false;
      for (const a of list) {
        const id = `announcement:${a.id}`;
        if (!this.items.some((e) => e.id === id)) {
          this.items = [
            {
              id,
              type: "announcement" as const,
              anime_id: null,
              url: "/",
              title: a.title,
              message: a.body,
              cover: null,
              created_at: a.created_at,
              read: false,
            },
            ...this.items,
          ].slice(0, MAX_ENTRIES);
          changed = true;
        }
      }
      if (changed) {
        this.persist();
      }
    } catch {
      // ignore network errors
    }
  }

  /** Start background polling so new announcements pop in the bell automatically. */
  startSync(): void {
    if (this.syncStarted) return;
    this.syncStarted = true;
    void this.syncAnnouncements();

    if (typeof window !== "undefined") {
      window.setInterval(() => {
        if (typeof document !== "undefined" && document.visibilityState === "visible") {
          void this.syncAnnouncements();
        }
      }, 20_000);

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          void this.syncAnnouncements();
        }
      });
    }
  }

  /** No-op if an entry with this id already exists — callers re-run their
   * detection checks periodically and shouldn't duplicate the same event. */
  add(entry: Omit<NotificationEntry, "read">): void {
    if (this.items.some((e) => e.id === entry.id)) return;
    this.items = [{ ...entry, read: false }, ...this.items].slice(0, MAX_ENTRIES);
    this.persist();
  }

  markRead(id: string): void {
    this.items = this.items.map((e) => (e.id === id ? { ...e, read: true } : e));
    this.persist();
  }

  markAllRead(): void {
    this.items = this.items.map((e) => (e.read ? e : { ...e, read: true }));
    this.persist();
  }

  clear(): void {
    this.items = [];
    this.persist();
  }

  get unreadCount(): number {
    return this.items.filter((e) => !e.read).length;
  }
}

export const notificationHistory = new NotificationHistoryStore();
