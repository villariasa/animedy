<script lang="ts">
  import { getTodayReleases } from "$lib/api/anilist";
  import { getAllLocalProgress } from "$lib/db/local";
  import { displayTitle } from "$lib/format";
  import { likes } from "$lib/stores/likes.svelte";
  import { router } from "$lib/router.svelte";
  import { notifyNewEpisodeOnce } from "$lib/notifications";

  interface Notice {
    anime_id: number;
    episode: number;
    title: string;
    cover: string | null;
  }

  let notices = $state<Notice[]>([]);

  // Once per site open: liked anime ∩ episodes aired today, minus already
  // watched. getTodayReleases is network-first with IndexedDB fallback, so
  // this also works from cache when offline.
  $effect(() => {
    if (likes.items.length > 0) {
      void (async () => {
        try {
          const [releases, progress] = await Promise.all([getTodayReleases(), getAllLocalProgress()]);
          const likedIds = new Set(likes.items.map((i) => i.anime_id));
          const maxWatched: Record<number, number> = {};
          for (const row of progress) {
            const ep = row.episode_number ?? 0;
            if (ep > (maxWatched[row.anime_id] ?? 0)) {
              maxWatched[row.anime_id] = ep;
            }
          }
          notices = releases
            .filter((r) => likedIds.has(r.item.anime_id) && (maxWatched[r.item.anime_id] ?? 0) < r.episode)
            .slice(0, 4)
            .map((r) => ({
              anime_id: r.item.anime_id,
              episode: r.episode,
              title: displayTitle(r.item.title_english, r.item.title_romaji),
              cover: r.item.cover_image
            }));
          if (notices.length > 0) {
            setTimeout(() => (notices = []), 12_000);
          }
          for (const n of notices) {
            notifyNewEpisodeOnce(n.anime_id, n.episode, n.title, n.cover);
          }
        } catch {
          notices = [];
        }
      })();
    }
  });

  function watch(n: Notice): void {
    notices = notices.filter((x) => x.anime_id !== n.anime_id);
    router.go(`/watch/${n.anime_id}/${n.episode}`);
  }
</script>

{#if notices.length > 0}
  <div class="fixed right-4 top-16 z-[75] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" role="status" aria-live="polite">
    {#each notices as n (n.anime_id)}
      <div class="flex items-center gap-3 rounded-xl border border-rose-500/40 bg-card/95 p-3 shadow-2xl backdrop-blur">
        <div class="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
          {#if n.cover}
            <img src={n.cover} alt="" class="h-full w-full object-cover" />
          {/if}
        </div>
        <div class="min-w-0 flex-1">
          <p class="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-rose-400">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3 w-3" aria-hidden="true">
              <path d="M10 2a6 6 0 0 0-6 6c0 1.887-.454 3.665-1.257 5.234a.75.75 0 0 0 .515 1.076 32.91 32.91 0 0 0 3.256.508 3.5 3.5 0 0 0 6.972 0 32.903 32.903 0 0 0 3.256-.508.75.75 0 0 0 .515-1.076A11.448 11.448 0 0 1 16 8a6 6 0 0 0-6-6ZM8.05 14.943a33.54 33.54 0 0 0 3.9 0 2 2 0 0 1-3.9 0Z" />
            </svg>
            New episode out!
          </p>
          <p class="truncate text-sm font-semibold">{n.title}</p>
          <p class="text-xs text-muted-foreground">Episode {n.episode} just released</p>
        </div>
        <button
          type="button"
          class="shrink-0 rounded-lg bg-rose-500 px-2.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-rose-600"
          onclick={() => watch(n)}
        >
          Watch
        </button>
        <button
          type="button"
          class="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
          onclick={() => (notices = notices.filter((x) => x.anime_id !== n.anime_id))}
          aria-label="Dismiss"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-3.5 w-3.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    {/each}
  </div>
{/if}
