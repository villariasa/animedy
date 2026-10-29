<script lang="ts">
  import { displayTitle } from "$lib/format";
  import { router } from "$lib/router.svelte";
  import TrendingSuggestions from "$lib/components/TrendingSuggestions.svelte";
  import { latestProgressByAnime } from "$lib/continuation";
  import type { LocalProgress } from "$lib/db/local";
  import {
    watchStatusStore,
    WATCH_STATUS_ORDER,
    WATCH_STATUS_LABELS,
    type WatchStatus
  } from "$lib/stores/watchStatus.svelte";

  type TabFilter = "all" | WatchStatus;

  let activeFilter = $state<TabFilter>("all");

  const filteredItems = $derived(
    activeFilter === "all" ? watchStatusStore.items : watchStatusStore.byStatus(activeFilter)
  );

  // So "Watching" cards can offer a direct Resume shortcut.
  let progressByAnime = $state<Map<number, LocalProgress>>(new Map());
  $effect(() => {
    void latestProgressByAnime().then((rows) => {
      progressByAnime = new Map(rows.map((row) => [row.anime_id, row]));
    });
  });

  const STATUS_BADGE_CLASS: Record<WatchStatus, string> = {
    watching: "bg-primary/20 text-primary",
    completed: "bg-emerald-500/20 text-emerald-400",
    plan_to_watch: "bg-amber-500/20 text-amber-400",
    dropped: "bg-muted text-muted-foreground"
  };
</script>

<div class="flex flex-col gap-6">
  <!-- Header -->
  <div class="flex flex-wrap items-center justify-between gap-4 border-b border-border/80 pb-5">
    <div class="flex items-center gap-3.5">
      <span class="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-purple-600 text-primary-foreground shadow-lg shadow-primary/25 ring-2 ring-primary/30">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-6 w-6" aria-hidden="true">
          <path fill-rule="evenodd" d="M4 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v14l-6-3-6 3V4Z" clip-rule="evenodd" />
        </svg>
      </span>
      <div>
        <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">My List</h1>
        <p class="text-xs sm:text-sm font-medium text-slate-300 mt-0.5">
          Track what you're watching · <span class="font-bold text-white">{watchStatusStore.count} {watchStatusStore.count === 1 ? 'anime' : 'animes'}</span>
        </p>
      </div>
    </div>
  </div>

  <!-- Status Filter Tabs -->
  <div class="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
    <button
      type="button"
      onclick={() => (activeFilter = "all")}
      class="rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold whitespace-nowrap transition-all {activeFilter === 'all'
        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
        : 'bg-card/90 text-foreground border border-border/80 hover:border-primary/50'}"
    >
      All ({watchStatusStore.count})
    </button>
    {#each WATCH_STATUS_ORDER as status (status)}
      <button
        type="button"
        onclick={() => (activeFilter = status)}
        class="rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold whitespace-nowrap transition-all {activeFilter === status
          ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
          : 'bg-card/90 text-foreground border border-border/80 hover:border-primary/50'}"
      >
        {WATCH_STATUS_LABELS[status]} ({watchStatusStore.countFor(status)})
      </button>
    {/each}
  </div>

  {#if watchStatusStore.count === 0}
    <div class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
      <div class="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-7 w-7" aria-hidden="true">
          <path fill-rule="evenodd" d="M4 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v14l-6-3-6 3V4Z" clip-rule="evenodd" />
        </svg>
      </div>
      <h3 class="mt-4 text-base font-semibold">Your list is empty</h3>
      <p class="mt-1 max-w-sm text-xs text-muted-foreground">
        Open any anime's detail page and set its status (Watching, Plan to Watch, Completed, Dropped) to track it here.
      </p>
      <button
        type="button"
        onclick={() => router.go("/")}
        class="mt-5 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
      >
        Browse Anime
      </button>
      <TrendingSuggestions />
    </div>
  {:else if filteredItems.length === 0}
    <p class="py-12 text-center text-sm text-muted-foreground">Nothing in this list yet.</p>
  {:else}
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {#each filteredItems as item (item.anime_id)}
        {@const progress = progressByAnime.get(item.anime_id)}
        <div class="group relative flex w-full min-w-0 flex-col gap-2 rounded-xl text-left">
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
            <span class="absolute top-2 left-2 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur {STATUS_BADGE_CLASS[item.status]}">
              {WATCH_STATUS_LABELS[item.status]}
            </span>
            <div class="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent"></div>
          </button>

          {#if item.status === "watching" && progress}
            <button
              type="button"
              class="absolute bottom-2 left-2 right-2 inline-flex items-center justify-center gap-1 rounded-lg bg-primary/90 px-2 py-1.5 text-[11px] font-bold text-primary-foreground shadow backdrop-blur transition-colors hover:bg-primary"
              onclick={() => router.go(`/watch/${item.anime_id}/${progress.episode_number ?? 1}`)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3 w-3" aria-hidden="true">
                <path d="M6.3 2.841A1.5 1.5 0 0 0 4 4.11V15.89a1.5 1.5 0 0 0 2.3 1.269l9.344-5.89a1.5 1.5 0 0 0 0-2.538L6.3 2.84Z" />
              </svg>
              Resume EP {progress.episode_number ?? 1}
            </button>
          {/if}

          <!-- Remove from list -->
          <button
            type="button"
            class="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-muted-foreground shadow-md backdrop-blur transition-transform hover:scale-110 hover:text-destructive active:scale-90"
            onclick={() => watchStatusStore.clearStatus(item.anime_id)}
            title="Remove from list"
            aria-label="Remove from list"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>

          <div class="w-full min-w-0 overflow-hidden">
            <button
              type="button"
              class="block w-full truncate text-left text-sm font-semibold tracking-tight transition-colors hover:text-primary"
              onclick={() => router.go(`/anime/${item.anime_id}`)}
              title={displayTitle(item.title_english, item.title_romaji)}
            >
              {displayTitle(item.title_english, item.title_romaji)}
            </button>
            <p class="mt-0.5 truncate text-xs text-muted-foreground">
              {[item.format, item.season_year].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
