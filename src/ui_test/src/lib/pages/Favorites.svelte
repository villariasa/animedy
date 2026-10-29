<script lang="ts">
  import { getAiringInfo, getTodayReleases, type AiringInfo, type TodayRelease } from "$lib/api/anilist";
  import { getAllLocalProgress, type LocalProgress } from "$lib/db/local";
  import { displayTitle, formatCountdown, statusLabel, statusBadgeClass } from "$lib/format";
  import { likes } from "$lib/stores/likes.svelte";
  import { router } from "$lib/router.svelte";
  import { Button } from "$lib/components/ui/button";

  let searchQuery = $state("");
  let airing = $state<Map<number, AiringInfo>>(new Map());
  let todayByAnime = $state<Map<number, TodayRelease>>(new Map());
  let progressRows = $state<LocalProgress[]>([]);
  let nowMs = $state(Date.now());

  // Live countdown tick (per minute).
  $effect(() => {
    const t = setInterval(() => (nowMs = Date.now()), 60_000);
    return () => clearInterval(t);
  });

  $effect(() => {
    const ids = likes.items.map((i) => i.anime_id);
    if (ids.length > 0) {
      void getAiringInfo(ids).then((m) => (airing = m)).catch(() => undefined);
      void getTodayReleases()
        .then((rel) => (todayByAnime = new Map(rel.map((r) => [r.item.anime_id, r]))))
        .catch(() => undefined);
    }
    void getAllLocalProgress().then((rows) => (progressRows = rows)).catch(() => undefined);
  });

  /** Highest episode the user has opened/watched for an anime (0 = not started). */
  function watchedUpTo(animeId: number): number {
    let max = 0;
    for (const row of progressRows) {
      if (row.anime_id === animeId && (row.episode_number ?? 0) > max) {
        max = row.episode_number ?? 0;
      }
    }
    return max;
  }

  /** NEW = an episode aired TODAY (real time) and the user hasn't watched it yet. */
  function newEpisode(animeId: number): TodayRelease | null {
    const rel = todayByAnime.get(animeId);
    return rel && watchedUpTo(animeId) < rel.episode ? rel : null;
  }

  const filteredItems = $derived(
    searchQuery.trim()
      ? likes.items.filter((item) => {
          const q = searchQuery.toLowerCase();
          return (
            item.title_english?.toLowerCase().includes(q) ||
            item.title_romaji?.toLowerCase().includes(q)
          );
        })
      : likes.items
  );
</script>

<div class="flex flex-col gap-6">
  <!-- Header -->
  <div class="flex flex-wrap items-center justify-between gap-4 border-b border-border/80 pb-5">
    <div class="flex items-center gap-3.5">
      <span class="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-500/25 ring-2 ring-rose-500/30">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-6 w-6" aria-hidden="true">
          <path d="m9.653 16.915-.005-.003-.019-.01a20.759 20.759 0 0 1-1.16-1.107 20.373 20.373 0 0 1-3.69-4.836A7.472 7.472 0 0 1 4 7.5C4 4.462 6.462 2 9.5 2a5.498 5.498 0 0 1 4.298 2.043A5.498 5.498 0 0 1 18.5 7.5c0 1.258-.337 2.44-.925 3.46a20.373 20.373 0 0 1-3.69 4.836 20.758 20.758 0 0 1-1.16 1.107l-.02.01-.005.003h-.002a.75.75 0 0 1-.698 0l-.002-.003Z" />
        </svg>
      </span>
      <div>
        <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">Liked Anime</h1>
        <p class="text-xs sm:text-sm font-medium text-slate-300 mt-0.5">
          Your saved collection of loved series · <span class="font-bold text-white">{likes.count} {likes.count === 1 ? 'anime' : 'animes'}</span>
        </p>
      </div>
    </div>

    {#if likes.items.length > 0}
      <div class="relative w-full sm:w-72">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none">
          <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clip-rule="evenodd" />
        </svg>
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Filter liked anime…"
          class="h-10 w-full rounded-xl border border-border/80 bg-card/90 pl-9 pr-8 text-xs text-foreground placeholder:text-muted-foreground shadow-sm backdrop-blur transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {#if searchQuery}
          <button
            type="button"
            onclick={() => (searchQuery = "")}
            class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
            aria-label="Clear filter"
          >
            ✕
          </button>
        {/if}
      </div>
    {/if}
  </div>

  {#if likes.items.length === 0}
    <div class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
      <div class="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-7 w-7">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
        </svg>
      </div>
      <h3 class="mt-4 text-base font-semibold">No loved anime yet</h3>
      <p class="mt-1 max-w-sm text-xs text-muted-foreground">
        Click the heart icon on any anime card or detail page to add it to your collection!
      </p>
      <Button class="mt-5" onclick={() => router.go("/")}>Browse Anime</Button>
    </div>
  {:else if filteredItems.length === 0}
    <p class="py-12 text-center text-sm text-muted-foreground">No matches found for "{searchQuery}".</p>
  {:else}
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {#each filteredItems as item (item.anime_id)}
        {@const info = airing.get(item.anime_id)}
        {@const fresh = newEpisode(item.anime_id)}
        {@const upTo = watchedUpTo(item.anime_id)}
        <div class="group relative flex w-full min-w-0 overflow-hidden flex-col gap-2 rounded-xl text-left">
          <!-- Anime Cover Image Preview Box -->
          <button
            type="button"
            class="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-muted shadow-sm ring-1 ring-border/40 transition-all duration-300 group-hover:shadow-md group-hover:ring-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onclick={() => router.go(`/anime/${item.anime_id}`)}
          >
            {#if item.cover_image}
              <img
                src={item.cover_image}
                alt=""
                loading="lazy"
                class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            {/if}

            {#if fresh}
              <span class="absolute top-2 left-2 animate-pulse rounded-md bg-rose-500 px-1.5 py-0.5 text-[10px] font-black tracking-wide text-white shadow-md">
                NEW EP {fresh.episode}
              </span>
            {:else if item.format}
              <span class="absolute top-2 left-2 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
                {item.format}
              </span>
            {/if}

            {#if info?.next_airing_at}
              <span class="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-2.5 w-2.5 text-amber-400" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clip-rule="evenodd" />
                </svg>
                EP {info.next_episode} in {formatCountdown(info.next_airing_at, nowMs)}
              </span>
            {/if}

            <div class="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent"></div>
          </button>

          <!-- Unlike Button Floating Icon -->
          <button
            type="button"
            class="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-rose-500 shadow-md backdrop-blur transition-transform hover:scale-110 active:scale-90"
            onclick={() => likes.toggleLike(item)}
            title="Remove from Liked"
            aria-label="Remove from Liked"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
              <path d="m9.653 16.915-.005-.003-.019-.01a20.759 20.759 0 0 1-1.16-1.107 20.373 20.373 0 0 1-3.69-4.836A7.472 7.472 0 0 1 4 7.5C4 4.462 6.462 2 9.5 2a5.498 5.498 0 0 1 4.298 2.043A5.498 5.498 0 0 1 18.5 7.5c0 1.258-.337 2.44-.925 3.46a20.373 20.373 0 0 1-3.69 4.836 20.758 20.758 0 0 1-1.16 1.107l-.02.01-.005.003h-.002a.75.75 0 0 1-.698 0l-.002-.003Z" />
            </svg>
          </button>

          <!-- Details -->
          <div class="w-full min-w-0 overflow-hidden">
            <button
              type="button"
              class="block w-full truncate text-left text-sm font-semibold tracking-tight transition-colors hover:text-primary"
              onclick={() => router.go(`/anime/${item.anime_id}`)}
              title={displayTitle(item.title_english, item.title_romaji)}
            >
              {displayTitle(item.title_english, item.title_romaji)}
            </button>
            <p class="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              {[item.format, item.season_year].filter(Boolean).join(" · ")}
              {#if info?.status}
                <span class="shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold {statusBadgeClass(info.status)}">
                  {statusLabel(info.status)}
                </span>
              {/if}
            </p>
            <!-- Where the user left off -->
            <p class="mt-1 truncate text-[11px] {fresh ? 'font-semibold text-rose-400' : 'text-muted-foreground'}">
              {#if fresh}
                EP {fresh.episode} out — not watched yet
              {:else if upTo > 0}
                You're on EP {upTo}{info?.latest_episode ? ` of ${info.latest_episode}` : ""}
              {:else}
                Not started
              {/if}
            </p>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
