// Thin wrapper around the browser Notification API, so a new episode can
// reach the user even when the tab isn't focused. Permission is requested
// from an explicit user action — either the Settings toggle, or the one-time
// onload prompt (NotificationPrompt.svelte) — never silently.
const NOTIFIED_KEY = "animedy.notified_episodes";
const NOTIFIED_MAX = 200;

// Local alias instead of the ambient DOM `NotificationPermission` type —
// this project's eslint config flags bare global type names as undefined
// when referenced from .svelte script blocks.
export type NotifPermission = "default" | "granted" | "denied";

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotifPermission {
  return notificationsSupported() ? Notification.permission : "denied";
}

export async function requestNotificationPermission(): Promise<NotifPermission> {
  if (!notificationsSupported()) return "denied";
  return await Notification.requestPermission();
}

function readNotified(): Set<string> {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function persistNotified(ids: Set<string>): void {
  try {
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...ids].slice(-NOTIFIED_MAX)));
  } catch {
    // storage quota or disabled
  }
}

/** Fires a real OS notification for (animeId, episode) once, ever — dedup
 * is tracked separately from in-app state so it survives across sessions. */
export function notifyNewEpisodeOnce(animeId: number, episode: number, title: string, cover: string | null): void {
  if (notificationPermission() !== "granted") return;
  const id = `${animeId}:${episode}`;
  const notified = readNotified();
  if (notified.has(id)) return;
  notified.add(id);
  persistNotified(notified);
  try {
    const notif = new Notification(`New episode: ${title}`, {
      body: `Episode ${episode} just released`,
      icon: cover ?? "/icons/icon.svg",
      tag: id
    });
    notif.onclick = () => {
      window.focus();
      location.hash = `/anime/${animeId}`;
      notif.close();
    };
  } catch {
    // Notification constructor can throw in some embedded/webview contexts
  }
}

/** Random discovery pick — "you might like this" nudge, unrelated to
 * anything the user follows. Caller owns the once-a-day cap; this just
 * fires the OS notification and wires click-through to the anime page. */
export function notifyDiscoveryPick(animeId: number, title: string, cover: string | null, reason: string): void {
  if (notificationPermission() !== "granted") return;
  try {
    const notif = new Notification(`You might like: ${title}`, {
      body: reason,
      icon: cover ?? "/icons/icon.svg",
      tag: `discovery:${animeId}`
    });
    notif.onclick = () => {
      window.focus();
      location.hash = `/anime/${animeId}`;
      notif.close();
    };
  } catch {
    // Notification constructor can throw in some embedded/webview contexts
  }
}
