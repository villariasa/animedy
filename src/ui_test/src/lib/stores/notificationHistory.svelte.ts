// Persisted log behind the header bell icon — separate from the OS-level
// Notification API (notifications.ts). That API is fire-and-forget and
// only reaches the user if permission was granted; this store is what the
// in-app bell icon reads, so notifications still show up here even if the
// user never granted (or denied) browser notification permission.
export type NotificationType = "episode" | "discovery";

export interface NotificationEntry {
  /** Dedup key — e.g. "episode:123:5" or "discovery:123:<timestamp>". */
  id: string;
  type: NotificationType;
  anime_id: number;
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
