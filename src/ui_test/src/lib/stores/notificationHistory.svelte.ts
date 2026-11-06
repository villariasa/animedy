// Persisted log behind the header bell icon — separate from the OS-level
// Notification API (notifications.ts). That API is fire-and-forget and
// only reaches the user if permission was granted; this store is what the
// in-app bell icon reads, so notifications still show up here even if the
// user never granted (or denied) browser notification permission.
import { getToken, loadStoredUser } from "$lib/api/account";

export type NotificationType = "announcement" | "feedback" | "episode" | "discovery" | "system";

export interface NotificationEntry {
  /** Dedup key — e.g. "announcement:123", "feedback:45", "episode:123:5". */
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
const DISMISSED_KEY = "animedy.notification_dismissed";
const MAX_ENTRIES = 50;
const MAX_DISMISSED = 200;

class NotificationHistoryStore {
  items = $state<NotificationEntry[]>([]);
  private syncStarted = false;
  /** Ids the user cleared/dismissed — the background syncs must never
   * resurrect these (the server still returns them on every poll). */
  private dismissed = new Set<string>();

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
    try {
      const raw = localStorage.getItem(DISMISSED_KEY);
      this.dismissed = raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch {
      this.dismissed = new Set();
    }
  }

  private persistDismissed(): void {
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify([...this.dismissed].slice(-MAX_DISMISSED)));
    } catch {
      // storage quota or disabled
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

      // Admin-deleted announcements get pulled back out of the bell: any
      // local announcement entry missing from the server feed is removed.
      // Guard: only entries NEWER than the oldest row the feed returned —
      // the feed is capped at 50, so genuinely old entries falling off the
      // end must not be mistaken for deletions.
      const serverIds = new Set(list.map((a) => `announcement:${a.id}`));
      const oldest = list.length > 0 ? Math.min(...list.map((a) => a.id)) : 0;
      const pruned = this.items.filter(
        (e) =>
          e.type !== "announcement" ||
          serverIds.has(e.id) ||
          Number(e.id.split(":")[1]) < oldest
      );
      if (pruned.length !== this.items.length) {
        this.items = pruned;
        changed = true;
      }

      for (const a of list) {
        const id = `announcement:${a.id}`;
        if (!this.dismissed.has(id) && !this.items.some((e) => e.id === id)) {
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

  /** For admin users: fetch recent feedback submissions into the notification bell. */
  async syncAdminFeedback(): Promise<void> {
    const user = loadStoredUser();
    if (!user || user.role !== "admin") return;
    const token = getToken();
    if (!token) return;

    try {
      const res = await fetch("/api/admin/feedback", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = (await res.json()) as { data?: { feedback?: Array<{ id: number; nickname: string; body: string; created_at: string }> } };
      const list = json?.data?.feedback;
      if (!Array.isArray(list)) return;

      let changed = false;
      for (const fb of list) {
        const id = `feedback:${fb.id}`;
        if (!this.dismissed.has(id) && !this.items.some((e) => e.id === id)) {
          this.items = [
            {
              id,
              type: "feedback" as const,
              anime_id: null,
              url: "#/admin",
              title: `Feedback from ${fb.nickname}`,
              message: fb.body,
              cover: null,
              created_at: fb.created_at,
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

  /** For admin users: surface fresh sign-ups (last 48h) in the bell. */
  async syncAdminSignups(): Promise<void> {
    const user = loadStoredUser();
    if (!user || user.role !== "admin") return;
    const token = getToken();
    if (!token) return;

    try {
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = (await res.json()) as {
        data?: { users?: Array<{ id: number; username: string; created_at: string }> };
      };
      const list = json?.data?.users;
      if (!Array.isArray(list)) return;

      const cutoff = Date.now() - 48 * 60 * 60 * 1000;
      let changed = false;
      for (const u of list) {
        if (u.id === user.id) continue; // not your own signup
        const createdMs = Date.parse(
          u.created_at.includes("T") ? u.created_at : u.created_at.replace(" ", "T") + "Z"
        );
        if (Number.isNaN(createdMs) || createdMs < cutoff) continue;
        const id = `signup:${u.id}`;
        if (!this.dismissed.has(id) && !this.items.some((e) => e.id === id)) {
          this.items = [
            {
              id,
              type: "system" as const,
              anime_id: null,
              url: "#/admin",
              title: "New user signed up",
              message: `${u.username} just joined Animedy.`,
              cover: null,
              created_at: u.created_at,
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

  async syncAll(): Promise<void> {
    await Promise.allSettled([
      this.syncAnnouncements(),
      this.syncAdminFeedback(),
      this.syncAdminSignups(),
    ]);
  }

  /** Start background polling so announcements and feedback pop into the bell automatically. */
  startSync(): void {
    if (this.syncStarted) return;
    this.syncStarted = true;
    void this.syncAll();

    if (typeof window !== "undefined") {
      window.setInterval(() => {
        if (typeof document !== "undefined" && document.visibilityState === "visible") {
          void this.syncAll();
        }
      }, 15_000);

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          void this.syncAll();
        }
      });
    }
  }

  /** No-op if an entry with this id already exists — callers re-run their
   * detection checks periodically and shouldn't duplicate the same event. */
  add(entry: Omit<NotificationEntry, "read">): void {
    if (this.dismissed.has(entry.id) || this.items.some((e) => e.id === entry.id)) return;
    this.items = [{ ...entry, read: false }, ...this.items].slice(0, MAX_ENTRIES);
    this.persist();
  }

  /** True if this id is in the bell OR was dismissed/cleared by the user.
   * Notifiers must dedup against THIS (not just items) — a dismissed entry
   * leaves `items`, but re-showing it would undo the user's dismissal. */
  has(id: string): boolean {
    return this.dismissed.has(id) || this.items.some((e) => e.id === id);
  }

  /** Remove one notification for good (survives the background re-syncs). */
  dismiss(id: string): void {
    this.items = this.items.filter((e) => e.id !== id);
    this.dismissed.add(id);
    this.persist();
    this.persistDismissed();
  }

  markRead(id: string): void {
    this.items = this.items.map((e) => (e.id === id ? { ...e, read: true } : e));
    this.persist();
  }

  markAllRead(): void {
    this.items = this.items.map((e) => (e.read ? e : { ...e, read: true }));
    this.persist();
  }

  /** Sign-out wipe: drop ALL entries WITHOUT tombstoning them — public
   * announcements may legitimately reappear for the next session, but
   * account-private entries (feedback, sign-ups, welcome) won't re-sync
   * because their sources require the departed account's token. */
  clearOnLogout(): void {
    this.items = [];
    this.persist();
  }

  /** Clear everything for good — ids are tombstoned so the background
   * syncs don't bring them back on the next poll. */
  clear(): void {
    for (const e of this.items) this.dismissed.add(e.id);
    this.items = [];
    this.persist();
    this.persistDismissed();
  }

  get unreadCount(): number {
    return this.items.filter((e) => !e.read).length;
  }
}

export const notificationHistory = new NotificationHistoryStore();
