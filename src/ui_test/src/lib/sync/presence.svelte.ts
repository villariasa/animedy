// Presence heartbeat — tells the server (and the admin dashboard) that this
// device is online and what it's doing. Runs for guests too, keyed by an
// anonymous per-device id. Watch.svelte reports the playing episode through
// setWatching(); everything else just reports the current route name.

import { apiHeartbeat, getClientId } from "$lib/api/account";
import { router } from "$lib/router.svelte";

const HEARTBEAT_MS = 60_000;

export interface WatchingInfo {
  anime_id: number;
  episode_number: number;
  position_seconds?: number;
  title?: string | null;
  cover_image?: string | null;
}

class Presence {
  private watching: WatchingInfo | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    if (this.timer) return;
    this.beat();
    this.timer = setInterval(() => this.beat(), HEARTBEAT_MS);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") this.beat();
    });
  }

  /** Called by the watch page while an episode is loaded (null on leave). */
  setWatching(info: WatchingInfo | null): void {
    const changed =
      info?.anime_id !== this.watching?.anime_id ||
      info?.episode_number !== this.watching?.episode_number;
    this.watching = info;
    if (changed) this.beat();
  }

  updatePosition(positionSeconds: number): void {
    if (this.watching) this.watching.position_seconds = Math.round(positionSeconds);
  }

  private beat(): void {
    if (document.visibilityState === "hidden") return;
    const onWatchPage = router.current.name === "watch";
    void apiHeartbeat({
      client_id: getClientId(),
      page: router.current.name,
      anime_id: onWatchPage ? (this.watching?.anime_id ?? null) : null,
      episode_number: onWatchPage ? (this.watching?.episode_number ?? null) : null,
      position_seconds: onWatchPage ? (this.watching?.position_seconds ?? null) : null,
      title: onWatchPage ? (this.watching?.title ?? null) : null,
      cover_image: onWatchPage ? (this.watching?.cover_image ?? null) : null
    }).catch(() => undefined);
  }
}

export const presence = new Presence();
