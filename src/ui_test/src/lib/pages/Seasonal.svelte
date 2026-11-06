<script lang="ts">
  // Browse-by-season: Winter/Spring/Summer/Fall tabs + year picker, that
  // season's anime most-popular-first, with the usual like / add-to-list
  // actions on each card. "Next season" shows unaired premieres so people
  // can Plan-to-Watch ahead.
  import { getSeasonalAnime, currentSeason } from "$lib/api/anilist";
  import type { AnimeSearchResultItem, AnimeSeason } from "$lib/api/types";
  import { displayTitle } from "$lib/format";
  import { router } from "$lib/router.svelte";
  import { likes } from "$lib/stores/likes.svelte";
  import AddToListButton from "$lib/components/AddToListButton.svelte";

  let { season: initialSeason, year: initialYear }: { season?: AnimeSeason; year?: number } = $props();

  const now = currentSeason();
  const SEASONS: Array<{ value: AnimeSeason; label: string; emoji: string }> = [
    { value: "WINTER", label: "Winter", emoji: "❄️" },
    { value: "SPRING", label: "Spring", emoji: "🌸" },
    { value: "SUMMER", label: "Summer", emoji: "☀️" },
    { value: "FALL", label: "Fall", emoji: "🍂" }
  ];
  const YEARS = Array.from({ length: now.year + 2 - 1980 }, (_, i) => now.year + 1 - i);

  // Props only seed the initial selection — later changes happen in-page via
  // select(), and URL-driven changes remount the component ({#key} in App).
  // svelte-ignore state_referenced_locally
  let season = $state<AnimeSeason>(initialSeason ?? now.season);
  // svelte-ignore state_referenced_locally
  let year = $state(initialYear ?? now.year);
  let items = $state<AnimeSearchResultItem[]>([]);
  let page = $state(1);
  let hasNextPage = $state(false);
  let loading = $state(true);
  let loadingMore = $state(false);
  let errorMessage = $state("");

  const isCurrent = $derived(season === now.season && year === now.year);

  function seasonOffset(offset: 1 | -1): { season: AnimeSeason; year: number } {
    const order: AnimeSeason[] = ["WINTER", "SPRING", "SUMMER", "FALL"];
    let idx = order.indexOf(season) + offset;
    let y = year;
    if (idx < 0) {
      idx = 3;
      y -= 1;
    } else if (idx > 3) {
      idx = 0;
      y += 1;
    }
    return { season: order[idx] ?? "WINTER", year: y };
  }

  function select(nextSeason: AnimeSeason, nextYear: number): void {
    season = nextSeason;
    year = nextYear;
    // Keep the URL shareable/bookmarkable without triggering a re-mount.
    history.replaceState(null, "", `#/seasonal/${nextSeason.toLowerCase()}/${nextYear}`);
  }

  // (Re)load whenever the selection changes.
  $effect(() => {
    const s = season;
    const y = year;
    loading = true;
    errorMessage = "";
    page = 1;
    void getSeasonalAnime(s, y, 1)
      .then((result) => {
        if (s !== season || y !== year) return; // stale response
        items = result.items;
        hasNextPage = result.hasNextPage;
      })
      .catch((err) => {
        errorMessage = err instanceof Error ? err.message : "Failed to load season";
      })
      .finally(() => (loading = false));
  });

  async function loadMore(): Promise<void> {
    if (loadingMore || !hasNextPage) return;
    loadingMore = true;
    try {
      const result = await getSeasonalAnime(season, year, page + 1);
      page += 1;
      const known = new Set(items.map((i) => i.anime_id));
      items = [...items, ...result.items.filter((i) => !known.has(i.anime_id))];
      hasNextPage = result.hasNextPage;
    } catch {
      // keep the button; user can retry
    } finally {
      loadingMore = false;
    }
  }

  function seasonLabel(s: AnimeSeason): string {
    return SEASONS.find((x) => x.value === s)?.label ?? s;
  }
</script>

<div class="mx-auto flex w-full max-w-[1480px] flex-col gap-5 px-1 sm:px-6">
  <!-- Header -->
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 class="text-2xl font-extrabold tracking-tight">
        {SEASONS.find((s) => s.value === season)?.emoji}
        {seasonLabel(season)} {year}
        {#if isCurrent}
          <span class="ml-1.5 align-middle rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">Airing now</span>
        {/if}
      </h1>
      <p class="mt-0.5 text-xs text-muted-foreground">Anime premiering this broadcast season, most popular first.</p>
    </div>
    <div class="flex items-center gap-1.5">
      {#each [{ dir: -1 as const, label: "← Last season" }, { dir: 1 as const, label: "Next season →" }] as nav (nav.dir)}
        {@const target = seasonOffset(nav.dir)}
        <button
          type="button"
          onclick={() => select(target.season, target.year)}
          class="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {nav.label}
        </button>
      {/each}
    </div>
  </div>

  <!-- Season tabs + year picker -->
  <div class="flex flex-wrap items-center gap-2">
    <div class="flex overflow-hidden rounded-xl border border-border">
      {#each SEASONS as s (s.value)}
        <button
          type="button"
          onclick={() => select(s.value, year)}
          class="px-3.5 py-2 text-sm font-medium transition-colors {season === s.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}"
        >
          <span class="hidden sm:inline">{s.emoji}</span>
          {s.label}
        </button>
      {/each}
    </div>
    <select
      value={year}
      onchange={(e) => select(season, Number((e.currentTarget as HTMLSelectElement).value))}
      class="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      aria-label="Year"
    >
      {#each YEARS as y (y)}
        <option value={y}>{y}</option>
      {/each}
    </select>
  </div>

  {#if errorMessage}
    <p class="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{errorMessage}</p>
  {/if}

  <!-- Grid -->
  {#if loading}
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {#each Array.from({ length: 12 }, (_, i) => i) as i (i)}
        <div class="aspect-[2/3] animate-pulse rounded-xl bg-muted/60"></div>
      {/each}
    </div>
  {:else if items.length === 0}
    <p class="py-16 text-center text-sm text-muted-foreground">
      Nothing found for {seasonLabel(season)} {year}.
    </p>
  {:else}
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {#each items as item (item.anime_id)}
        <div class="group relative flex w-full min-w-0 flex-col gap-2 overflow-hidden rounded-xl text-left">
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
                decoding="async"
                class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            {/if}
            {#if item.format}
              <span class="absolute top-2 left-2 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
                {item.format}
              </span>
            {/if}
            <div class="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent"></div>
          </button>

          <!-- Like -->
          <button
            type="button"
            class="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 shadow-md backdrop-blur transition-transform hover:scale-110 active:scale-90 {likes.isLiked(item.anime_id) ? 'text-rose-500' : 'text-white/80'}"
            onclick={() => likes.toggleLike(item)}
            title={likes.isLiked(item.anime_id) ? "Remove from Liked" : "Add to Liked"}
            aria-label={likes.isLiked(item.anime_id) ? "Remove from Liked" : "Add to Liked"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
              <path d="m9.653 16.915-.005-.003-.019-.01a20.759 20.759 0 0 1-1.16-1.107 20.373 20.373 0 0 1-3.69-4.836A7.472 7.472 0 0 1 4 7.5C4 4.462 6.462 2 9.5 2a5.498 5.498 0 0 1 4.298 2.043A5.498 5.498 0 0 1 18.5 7.5c0 1.258-.337 2.44-.925 3.46a20.373 20.373 0 0 1-3.69 4.836 20.758 20.758 0 0 1-1.16 1.107l-.02.01-.005.003h-.002a.75.75 0 0 1-.698 0l-.002-.003Z" />
            </svg>
          </button>

          <!-- Add to List -->
          <div class="absolute top-2 right-10">
            <AddToListButton anime={item} />
          </div>

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
            <p class="mt-0.5 truncate text-xs text-muted-foreground">
              {#if item.score}<span class="font-semibold text-amber-400">★ {(item.score / 10).toFixed(1)}</span> · {/if}
              {[item.format, item.season_year].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
      {/each}
    </div>

    {#if hasNextPage}
      <div class="flex justify-center py-4">
        <button
          type="button"
          disabled={loadingMore}
          onclick={() => void loadMore()}
          class="rounded-xl border border-border px-6 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      </div>
    {/if}
  {/if}
</div>
