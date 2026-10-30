<script lang="ts">
  // Random "you might like this" nudge — unrelated to anything the user
  // actually follows (that's NewEpisodeNotifier's job). Pulled from
  // Trending + New Releases, capped at once per day, and skipped entirely
  // if the user hasn't opted in or hasn't granted notification permission.
  import { browseAnime } from "$lib/api/anilist";
  import { displayTitle } from "$lib/format";
  import { likes } from "$lib/stores/likes.svelte";
  import { watchStatusStore } from "$lib/stores/watchStatus.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import { notifyDiscoveryPick, notificationPermission } from "$lib/notifications";
  import { notificationHistory } from "$lib/stores/notificationHistory.svelte";

  const LAST_RUN_KEY = "animedy.discovery_notif_last_at";
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  function dueForCheck(): boolean {
    try {
      const raw = localStorage.getItem(LAST_RUN_KEY);
      if (!raw) return true;
      return Date.now() - Number(raw) >= ONE_DAY_MS;
    } catch {
      return true;
    }
  }

  function markRan(): void {
    try {
      localStorage.setItem(LAST_RUN_KEY, String(Date.now()));
    } catch {
      // storage quota or disabled
    }
  }

  async function maybeNotifyDiscovery(): Promise<void> {
    if (!settings.current.notify_discovery) return;
    if (notificationPermission() !== "granted") return;
    if (!dueForCheck()) return;
    // Mark as run up-front — a failed fetch shouldn't retry on every reload
    // for the rest of the day, it should just wait for tomorrow.
    markRan();
    try {
      const [trending, newReleases] = await Promise.all([
        browseAnime("trending", 1),
        browseAnime("new_releases", 1)
      ]);
      const followedIds = new Set([
        ...likes.items.map((i) => i.anime_id),
        ...watchStatusStore.items.map((i) => i.anime_id)
      ]);
      const pool = [...trending.items, ...newReleases.items].filter(
        (item) => !followedIds.has(item.anime_id) && item.cover_image
      );
      if (pool.length === 0) return;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      if (!pick) return;
      const isTrending = trending.items.some((item) => item.anime_id === pick.anime_id);
      const title = displayTitle(pick.title_english, pick.title_romaji);
      const reason = isTrending ? "Trending right now" : "Just premiered";
      notifyDiscoveryPick(pick.anime_id, title, pick.cover_image, reason);
      notificationHistory.add({
        id: `discovery:${pick.anime_id}:${Date.now()}`,
        type: "discovery",
        anime_id: pick.anime_id,
        title,
        message: reason,
        cover: pick.cover_image,
        created_at: new Date().toISOString()
      });
    } catch {
      // best-effort nudge, not a core feature — silent failure is fine
    }
  }

  $effect(() => {
    void settings.load();
  });

  $effect(() => {
    void maybeNotifyDiscovery();
  });
</script>
