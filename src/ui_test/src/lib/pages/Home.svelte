<script lang="ts">
  import { ApiError } from "$lib/api/client";
  import {
    browseAnime,
    searchAnime,
    getTodayReleases,
    ANILIST_GENRES,
    type BrowseTag,
    type TodayRelease
  } from "$lib/api/anilist";
  import type { AnimeFormat, AnimeSearchResultItem, ContinueWatchingItem } from "$lib/api/types";
  import ContinueWatchingCard from "$lib/components/ContinueWatchingCard.svelte";
  import HeroSpotlight from "$lib/components/HeroSpotlight.svelte";
  import CommunityShareBar from "$lib/components/CommunityShareBar.svelte";
  import WeeklySchedule from "$lib/components/WeeklySchedule.svelte";
  import { getContinueWatching } from "$lib/continuation";
  import { displayTitle, statusLabel, statusBadgeClass } from "$lib/format";
  import { router } from "$lib/router.svelte";
  import { likes } from "$lib/stores/likes.svelte";
  import { homeReset } from "$lib/stores/homeReset.svelte";

  type MainCuratedTab = "trending" | "today" | "new_releases";
  type RankingTab = "top_rated" | "trending" | "this_week" | "this_month";

  const SEARCH_DEBOUNCE_MS = 400;

  let query = $state("");
  let results = $state<AnimeSearchResultItem[]>([]);
  let searching = $state(false);
  let searchError = $state<string | null>(null);
  let continueItems = $state<ContinueWatchingItem[]>([]);
  let railError = $state<string | null>(null);
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  // Main grid tab (Trending / Popular)
  let activeTab = $state<MainCuratedTab>("trending");
  let curatedItems = $state<AnimeSearchResultItem[]>([]);
  let curatedLoading = $state(false);
  let curatedError = $state<string | null>(null);
  let curatedPage = $state(1);
  let curatedHasMore = $state(false);
  let loadingMore = $state(false);

  // Discovery filters applied to the curated grid.
  const FORMAT_OPTIONS: AnimeFormat[] = ["TV", "MOVIE", "OVA", "ONA", "SPECIAL", "TV_SHORT", "MUSIC"];
  const YEAR_OPTIONS = Array.from({ length: 35 }, (_, i) => new Date().getFullYear() + 1 - i);
  let filterGenre = $state("");
  let filterYear = $state("");
  let filterFormat = $state("");
  const filtersActive = $derived(Boolean(filterGenre || filterYear || filterFormat));

  function clearFilters(): void {
    filterGenre = "";
    filterYear = "";
    filterFormat = "";
  }

  function matchesFilters(item: AnimeSearchResultItem): boolean {
    if (filterGenre && !item.genres?.includes(filterGenre)) return false;
    if (filterYear && item.season_year !== Number(filterYear)) return false;
    if (filterFormat && item.format !== filterFormat) return false;
    return true;
  }

  const TAB_HEADERS: Record<MainCuratedTab, { title: string; subtitle: string }> = {
    trending: { title: "Popular Today", subtitle: "Realtime rankings from AniList activity, updated continuously" },
    today: { title: "Today Release", subtitle: "Episodes that aired today — realtime" },
    new_releases: { title: "New Releases", subtitle: "Freshly premiered anime, newest first" }
  };

  let todayMeta = $state<Map<number, TodayRelease>>(new Map());

  // Dedicated Ultra-HD Hero Spotlight items (always guaranteed panoramic banners)
  let spotlightItems = $state<AnimeSearchResultItem[]>([]);
  let spotlightLoading = $state(false);

  async function loadSpotlight(): Promise<void> {
    spotlightLoading = true;
    try {
      const pageResult = await browseAnime("trending");
      const withBanners = pageResult.items.filter((i) => Boolean(i.banner_image));
      if (withBanners.length >= 4) {
        spotlightItems = withBanners.slice(0, 8);
      } else {
        const popular = await browseAnime("popular");
        const popularWithBanners = popular.items.filter((i) => Boolean(i.banner_image));
        spotlightItems = [...withBanners, ...popularWithBanners].slice(0, 8);
      }
    } catch {
      spotlightItems = [];
    } finally {
      spotlightLoading = false;
    }
  }

  // Right sidebar ranking tab (Top Rated / Trending)
  let rankingTab = $state<RankingTab>("top_rated");
  let rankingItems = $state<AnimeSearchResultItem[]>([]);
  let rankingLoading = $state(false);
  let rankingError = $state<string | null>(null);

  async function runSearch(q: string): Promise<void> {
    searching = true;
    searchError = null;
    try {
      results = await searchAnime(q);
    } catch (err) {
      results = [];
      searchError = err instanceof ApiError ? err.message : "Search failed.";
    } finally {
      searching = false;
    }
  }

  function onQueryInput(): void {
    clearTimeout(debounceTimer);
    const q = query.trim();
    if (q.length >= 2) {
      debounceTimer = setTimeout(() => void runSearch(q), SEARCH_DEBOUNCE_MS);
    } else {
      results = [];
      searchError = null;
    }
  }

  function clearSearch(): void {
    query = "";
    results = [];
    searchError = null;
  }

  // Clicking "Home" while already on this route doesn't remount the
  // component (router.current doesn't change), so listen for an explicit
  // reset signal to clear any active search and go back to the curated tabs.
  let lastHomeResetToken = homeReset.token;
  $effect(() => {
    if (homeReset.token !== lastHomeResetToken) {
      lastHomeResetToken = homeReset.token;
      clearTimeout(debounceTimer);
      clearSearch();
      activeTab = "trending";
    }
  });

  function curatedTag(tab: MainCuratedTab): BrowseTag {
    return tab === "today" ? "trending" : tab;
  }

  function activeFilters() {
    return {
      genre: filterGenre || null,
      year: filterYear ? Number(filterYear) : null,
      format: (filterFormat || null) as AnimeFormat | null
    };
  }

  async function loadCurated(tab: MainCuratedTab): Promise<void> {
    curatedLoading = true;
    curatedError = null;
    curatedPage = 1;
    try {
      if (tab === "today") {
        // "Today" has no dedicated filtered query — apply filters client-side.
        const releases = await getTodayReleases();
        todayMeta = new Map(releases.map((r) => [r.item.anime_id, r]));
        curatedItems = releases.map((r) => r.item).filter(matchesFilters);
        curatedHasMore = false;
        return;
      }
      const pageResult = await browseAnime(curatedTag(tab), 1, activeFilters());
      curatedItems = pageResult.items;
      // AniList reports whether more pages exist — reliable no matter how many
      // entries the client-side filters drop from this page.
      curatedHasMore = tab === "new_releases" && pageResult.hasNextPage;
    } catch (err) {
      curatedError = err instanceof ApiError ? err.message : "Failed to load curated anime.";
    } finally {
      curatedLoading = false;
    }
  }

  async function loadMoreCurated(): Promise<void> {
    loadingMore = true;
    try {
      const pageResult = await browseAnime(curatedTag(activeTab), curatedPage + 1, activeFilters());
      curatedPage += 1;
      // Dedup in case rankings shifted between pages.
      const seen = new Set(curatedItems.map((i) => i.anime_id));
      curatedItems = [...curatedItems, ...pageResult.items.filter((i) => !seen.has(i.anime_id))];
      curatedHasMore = pageResult.hasNextPage;
    } catch {
      curatedHasMore = false;
    } finally {
      loadingMore = false;
    }
  }

  async function loadRankings(tab: RankingTab): Promise<void> {
    rankingLoading = true;
    rankingError = null;
    try {
      const { items } = await browseAnime(tab as BrowseTag);
      rankingItems = items.slice(0, 10);
    } catch (err) {
      rankingError = err instanceof ApiError ? err.message : "Failed to load rankings.";
    } finally {
      rankingLoading = false;
    }
  }

  $effect(() => {
    void loadSpotlight();
  });

  $effect(() => {
    // Synchronous reads so Svelte tracks these as dependencies — loadCurated
    // itself reads them only after an await, which wouldn't be tracked.
    void activeTab;
    void filterGenre;
    void filterYear;
    void filterFormat;
    void loadCurated(activeTab);
  });

  $effect(() => {
    void loadRankings(rankingTab);
  });


  // Continue Watching rail from this device's IndexedDB history.
  $effect(() => {
    void getContinueWatching()
      .then((items) => {
        continueItems = items;
        railError = null;
      })
      .catch(() => {
        railError = "Could not load Continue Watching.";
      });
  });
</script>

<div class="flex flex-col gap-8">
  <!-- Hero Spotlight Carousel (Unique dual-pane stage with upcoming rail) -->
  {#if query.trim().length < 2}
    {#if spotlightItems.length > 0}
      <HeroSpotlight items={spotlightItems} />
    {:else if curatedItems.filter((i) => Boolean(i.banner_image)).length > 0}
      <HeroSpotlight items={curatedItems.filter((i) => Boolean(i.banner_image)).slice(0, 8)} />
    {:else if spotlightLoading || curatedLoading}
      <div class="relative h-[440px] lg:h-[500px] w-full animate-pulse rounded-3xl border border-border/60 bg-card/40 p-8 flex flex-col justify-end">
        <div class="h-6 w-32 rounded-full bg-muted/60 mb-4"></div>
        <div class="h-10 w-2/3 rounded-xl bg-muted/60 mb-3"></div>
        <div class="h-4 w-1/3 rounded bg-muted/40 mb-6"></div>
        <div class="h-12 w-40 rounded-xl bg-muted/60"></div>
      </div>
    {/if}

    <!-- Love Animedy Community Sharing Bar -->
    <CommunityShareBar />
  {/if}

  <!-- Search bar with Tailwind Heroicons -->
  <search class="relative mx-auto w-full max-w-xl">
    <label class="flex flex-col gap-1" aria-label="Anime search">
      <div class="relative flex items-center">
        <!-- Magnifying glass icon -->
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="pointer-events-none absolute left-4 h-4 w-4 text-muted-foreground"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
          />
        </svg>

        <input
          type="search"
          placeholder="Search any anime, e.g. Frieren, Solo Leveling, Jujutsu..."
          bind:value={query}
          oninput={onQueryInput}
          class="h-12 w-full rounded-xl border border-input bg-card/60 pl-11 pr-10 text-base shadow-sm backdrop-blur transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />

        {#if query.trim().length > 0}
          <button
            type="button"
            onclick={clearSearch}
            class="absolute right-3.5 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Clear search"
          >
            <!-- X mark icon -->
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="h-4 w-4"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        {/if}
      </div>
    </label>
  </search>

  <!-- Continue watching rail (from this device's history) -->
  {#if continueItems.length > 0 || railError}
    <section aria-label="Continue watching">
      <h2 class="mb-3 text-lg font-semibold tracking-tight">Continue Watching</h2>
      {#if railError}
        <p class="text-sm text-destructive">{railError}</p>
      {:else}
        <div class="flex gap-3 overflow-x-auto pb-2">
          {#each continueItems as item (item.episode_id)}
            <ContinueWatchingCard {item} />
          {/each}
        </div>
      {/if}
    </section>
  {/if}

  <!-- Active Search View -->
  {#if query.trim().length >= 2}
    <section aria-label="Search results">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-lg font-semibold tracking-tight">
          Search Results for <span class="font-normal text-primary">"{query}"</span>
        </h2>
        <button
          type="button"
          onclick={clearSearch}
          class="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <!-- Arrow left icon -->
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="h-3.5 w-3.5"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Back to Popular
        </button>
      </div>

      {#if searching}
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {#each Array(6) as _, i (i)}
            <div class="flex animate-pulse flex-col gap-2">
              <div class="aspect-[2/3] w-full rounded-xl bg-muted/60"></div>
              <div class="h-4 w-3/4 rounded bg-muted/60"></div>
              <div class="h-3 w-1/2 rounded bg-muted/40"></div>
            </div>
          {/each}
        </div>
      {:else if searchError}
        <p class="text-sm text-destructive">{searchError}</p>
      {:else if results.length > 0}
        <ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {#each results as item (item.anime_id)}
            <li>
              <button
                type="button"
                class="group flex w-full flex-col gap-2 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onclick={() => router.go(`/anime/${item.anime_id}`)}
              >
                <div class="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-muted shadow-sm">
                  {#if item.cover_image}
                    <img
                      src={item.cover_image}
                      alt=""
                      loading="lazy"
                      class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  {/if}
                  {#if item.format}
                    <span class="absolute top-2 right-2 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white backdrop-blur">
                      {item.format}
                    </span>
                  {/if}
                </div>
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium transition-colors group-hover:text-primary">
                    {displayTitle(item.title_english, item.title_romaji)}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    {#if item.score}<span class="font-semibold text-amber-400">★ {(item.score / 10).toFixed(1)}</span> · {/if}{[item.format, item.season_year].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </button>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="text-sm text-muted-foreground">No anime found matching your query.</p>
      {/if}
    </section>
  {:else}
    <!-- Two-Column Discovery Layout: Main Feed (Left) + Top Rankings List (Right) -->
    <div class="flex flex-col gap-8 xl:flex-row xl:items-start">
      <!-- Left: Popular & Trending Cards Grid -->
      <section class="min-w-0 flex-1" aria-label="Curated anime">
        <div class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 class="text-2xl font-bold tracking-tight text-foreground">{TAB_HEADERS[activeTab].title}</h2>
            <p class="text-xs sm:text-sm text-muted-foreground mt-0.5">{TAB_HEADERS[activeTab].subtitle}</p>
          </div>

          <!-- Main Dashboard Tabs (High Visibility & Contrast) -->
          <div class="flex items-center gap-2 overflow-x-auto pb-1.5 sm:pb-0 scrollbar-none rounded-2xl border border-border/80 bg-card/90 p-1.5 shadow-lg backdrop-blur-xl">
            <button
              type="button"
              class="flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap {activeTab === 'trending'
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25 ring-1 ring-primary/40 font-bold'
                : 'bg-background/90 text-foreground border border-border/80 hover:border-primary/50 hover:bg-accent hover:text-primary shadow-sm'}"
              onclick={() => { activeTab = "trending"; query = ""; }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                class="h-4 w-4 shrink-0 {activeTab === 'trending' ? 'text-primary-foreground' : 'text-amber-500'}"
                aria-hidden="true"
              >
                <path
                  fill-rule="evenodd"
                  d="M13.5 4.938a7 7 0 1 1-9.006 1.737c.2-.202.4-.41.6-.621l.135-.143a1.5 1.5 0 0 0 .285-.898 3.5 3.5 0 0 1 5.986-2.477c.433.433.805.922 1.11 1.455.228.398.544.73.89.947ZM10 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
                  clip-rule="evenodd"
                />
              </svg>
              <span>Popular Today</span>
            </button>

            <button
              type="button"
              class="flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap {activeTab === 'today'
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25 ring-1 ring-primary/40 font-bold'
                : 'bg-background/90 text-foreground border border-border/80 hover:border-primary/50 hover:bg-accent hover:text-primary shadow-sm'}"
              onclick={() => { activeTab = "today"; query = ""; }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                class="h-4 w-4 shrink-0 {activeTab === 'today' ? 'text-primary-foreground' : 'text-sky-400'}"
                aria-hidden="true"
              >
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .2.08.39.22.53l3 3a.75.75 0 0 0 1.06-1.06l-2.78-2.78V5Z"
                  clip-rule="evenodd"
                />
              </svg>
              <span>Today Release</span>
              <span class="inline-flex items-center rounded-full px-1.5 py-0.2 text-[10px] font-extrabold {activeTab === 'today' ? 'bg-white/20 text-white' : 'bg-sky-500/20 text-sky-400'}">
                LIVE
              </span>
            </button>

            <button
              type="button"
              class="flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap {activeTab === 'new_releases'
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25 ring-1 ring-primary/40 font-bold'
                : 'bg-background/90 text-foreground border border-border/80 hover:border-primary/50 hover:bg-accent hover:text-primary shadow-sm'}"
              onclick={() => { activeTab = "new_releases"; query = ""; }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                class="h-4 w-4 shrink-0 {activeTab === 'new_releases' ? 'text-primary-foreground' : 'text-emerald-400'}"
                aria-hidden="true"
              >
                <path
                  fill-rule="evenodd"
                  d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z"
                  clip-rule="evenodd"
                />
              </svg>
              <span>New Releases</span>
            </button>
          </div>
        </div>

        <!-- Discovery Filters: Genre / Year / Format -->
        <div class="mb-6 flex flex-wrap items-center gap-2">
          <select
            bind:value={filterGenre}
            class="h-9 rounded-lg border border-border/80 bg-card/90 px-2.5 text-xs font-medium text-foreground shadow-sm backdrop-blur focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label="Filter by genre"
          >
            <option value="">All Genres</option>
            {#each ANILIST_GENRES as genre (genre)}
              <option value={genre}>{genre}</option>
            {/each}
          </select>

          <select
            bind:value={filterYear}
            class="h-9 rounded-lg border border-border/80 bg-card/90 px-2.5 text-xs font-medium text-foreground shadow-sm backdrop-blur focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label="Filter by year"
          >
            <option value="">All Years</option>
            {#each YEAR_OPTIONS as year (year)}
              <option value={year}>{year}</option>
            {/each}
          </select>

          <select
            bind:value={filterFormat}
            class="h-9 rounded-lg border border-border/80 bg-card/90 px-2.5 text-xs font-medium text-foreground shadow-sm backdrop-blur focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label="Filter by format"
          >
            <option value="">All Formats</option>
            {#each FORMAT_OPTIONS as format (format)}
              <option value={format}>{format.replace(/_/g, " ")}</option>
            {/each}
          </select>

          {#if filtersActive}
            <button
              type="button"
              onclick={clearFilters}
              class="inline-flex items-center gap-1 rounded-lg border border-border/80 bg-background/90 px-2.5 h-9 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground hover:border-primary/50"
            >
              Clear filters ✕
            </button>
          {/if}
        </div>

        {#if curatedLoading}
          <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5">
            {#each Array(10) as _, i (i)}
              <div class="flex animate-pulse flex-col gap-2">
                <div class="aspect-[2/3] w-full rounded-xl bg-muted/60"></div>
                <div class="h-4 w-3/4 rounded bg-muted/60"></div>
                <div class="h-3 w-1/2 rounded bg-muted/40"></div>
              </div>
            {/each}
          </div>
        {:else if curatedError}
          <p class="text-sm text-destructive">{curatedError}</p>
        {:else if curatedItems.length === 0}
          <p class="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            No anime found matching these filters.
            {#if filtersActive}
              <button type="button" onclick={clearFilters} class="ml-1 font-semibold text-primary hover:underline">
                Clear filters
              </button>
            {/if}
          </p>
        {:else}
          <ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5">
            {#each curatedItems as item, index (item.anime_id)}
              <li class="min-w-0 overflow-hidden">
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

                    <!-- Rank badge -->
                    {#if activeTab === 'today'}
                      {@const rel = todayMeta.get(item.anime_id)}
                      <span class="absolute top-2 left-2 rounded-md px-1.5 py-0.5 text-[10px] font-black tracking-wide shadow-md backdrop-blur {rel?.tag === 'new_anime' ? 'bg-green-400 text-green-950' : rel?.tag === 'new_season' ? 'bg-amber-400 text-amber-950' : 'bg-primary text-primary-foreground'}">
                        {rel?.tag === 'new_anime' ? 'NEW ANIME' : rel?.tag === 'new_season' ? 'NEW SEASON' : 'NEW EPISODE'}
                      </span>
                    {:else}
                      <span
                        class="absolute top-2 left-2 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold shadow-md backdrop-blur {
                          activeTab !== 'new_releases' && index === 0
                            ? 'bg-amber-400 text-amber-950 ring-2 ring-amber-200'
                            : activeTab !== 'new_releases' && index === 1
                            ? 'bg-slate-200 text-slate-900 ring-2 ring-slate-100'
                            : activeTab !== 'new_releases' && index === 2
                            ? 'bg-amber-700 text-amber-100 ring-2 ring-amber-600'
                            : 'bg-black/75 text-white'
                        }"
                      >
                        {activeTab === 'new_releases' ? 'NEW' : `#${index + 1}`}
                      </span>
                    {/if}

                    <!-- Format pill -->
                    {#if item.format}
                      <span class="absolute bottom-2 left-2 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
                        {item.format}
                      </span>
                    {/if}

                    <!-- Latest released episode pill -->
                    {#if item.latest_episode && item.latest_episode > 0}
                      <span class="absolute bottom-2 right-2 rounded-md bg-primary/90 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-primary-foreground shadow backdrop-blur">
                        EP {item.latest_episode}
                      </span>
                    {/if}

                    <div class="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent"></div>
                  </button>

                  <!-- Like / Love Button -->
                  <button
                    type="button"
                    class="absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/75 shadow backdrop-blur transition-transform hover:scale-110 active:scale-90 {likes.isLiked(item.anime_id) ? 'text-rose-500' : 'text-white/80 hover:text-rose-400'}"
                    onclick={(e) => {
                      e.stopPropagation();
                      likes.toggleLike(item);
                    }}
                    title={likes.isLiked(item.anime_id) ? "Loved" : "Love this anime"}
                    aria-label="Like anime"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
                      <path d="m9.653 16.915-.005-.003-.019-.01a20.759 20.759 0 0 1-1.16-1.107 20.373 20.373 0 0 1-3.69-4.836A7.472 7.472 0 0 1 4 7.5C4 4.462 6.462 2 9.5 2a5.498 5.498 0 0 1 4.298 2.043A5.498 5.498 0 0 1 18.5 7.5c0 1.258-.337 2.44-.925 3.46a20.373 20.373 0 0 1-3.69 4.836 20.758 20.758 0 0 1-1.16 1.107l-.02.01-.005.003h-.002a.75.75 0 0 1-.698 0l-.002-.003Z" />
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
                    <p class="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                      {#if item.score}
                        <span class="inline-flex items-center gap-0.5 font-semibold text-amber-400">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3 w-3" aria-hidden="true"><path fill-rule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z" clip-rule="evenodd" /></svg>
                          {(item.score / 10).toFixed(1)}
                        </span>
                        <span>·</span>
                      {/if}
                      {[item.format, item.season_year].filter(Boolean).join(" · ")}
                      {#if item.status}
                        <span class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold {statusBadgeClass(item.status)}">
                          {statusLabel(item.status)}
                        </span>
                      {/if}
                    </p>
                  </div>
                </div>
              </li>
            {/each}
          </ul>

          {#if activeTab === "new_releases" && curatedHasMore}
            <div class="mt-6 text-center">
              <button
                type="button"
                disabled={loadingMore}
                class="inline-flex items-center gap-2 rounded-lg border border-border bg-card/60 px-5 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
                onclick={() => void loadMoreCurated()}
              >
                {#if loadingMore}
                  <span class="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></span>
                  Loading…
                {:else}
                  Load More
                {/if}
              </button>
            </div>
          {/if}
        {/if}
      </section>

      <!-- Right: Top Rankings Leaderboard List & Weekly Airing Schedule -->
      <aside class="flex w-full flex-col gap-6 xl:w-96 2xl:w-[420px] shrink-0" aria-label="Sidebar rankings and schedule">
        <!-- Top Rankings Card -->
        <div class="rounded-2xl border border-border/70 bg-card/50 p-4 shadow-sm backdrop-blur">
          <!-- Rankings Header -->
          <div class="mb-3 flex items-center justify-between border-b border-border/50 pb-3">
            <div class="flex items-center gap-2">
              <!-- Trophy Icon (Heroicon SVG) -->
              <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.75"
                  stroke="currentColor"
                  class="h-4 w-4"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.003 0H9.497m5.003 0a3.375 3.375 0 0 0 3.375-3.375V6.75A2.25 2.25 0 0 0 15.625 4.5h-7.25A2.25 2.25 0 0 0 6.125 6.75v5.25a3.375 3.375 0 0 0 3.375 3.375Z"
                  />
                </svg>
              </span>
              <div>
                <h3 class="text-sm font-bold tracking-tight">Top Rankings</h3>
                <p class="text-[11px] text-muted-foreground">Most popular anime leaderboard</p>
              </div>
            </div>
          </div>

          <!-- 4 Rankings Tabs: Top Rated | Trending | This Week | This Month -->
          <div class="mb-3.5 grid grid-cols-4 gap-1 rounded-lg border border-border/80 bg-background/60 p-1 text-[11px]">
            <button
              type="button"
              class="rounded py-1 text-center font-medium transition-colors {rankingTab === 'top_rated' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
              onclick={() => (rankingTab = 'top_rated')}
            >
              Top Rated
            </button>
            <button
              type="button"
              class="rounded py-1 text-center font-medium transition-colors {rankingTab === 'trending' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
              onclick={() => (rankingTab = 'trending')}
            >
              Trending
            </button>
            <button
              type="button"
              class="rounded py-1 text-center font-medium transition-colors {rankingTab === 'this_week' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
              onclick={() => (rankingTab = 'this_week')}
            >
              This Week
            </button>
            <button
              type="button"
              class="rounded py-1 text-center font-medium transition-colors {rankingTab === 'this_month' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
              onclick={() => (rankingTab = 'this_month')}
            >
              This Month
            </button>
          </div>

          <!-- Rankings List items in Image 1 style -->
          {#if rankingLoading}
            <div class="flex flex-col gap-2.5">
              {#each Array(6) as _, i (i)}
                <div class="flex h-16 animate-pulse items-center gap-3 rounded-xl border border-border/40 bg-muted/30 p-3">
                  <div class="h-8 w-8 rounded-full bg-muted/60"></div>
                  <div class="flex-1 space-y-2">
                    <div class="h-3.5 w-3/4 rounded bg-muted/60"></div>
                    <div class="h-2.5 w-1/3 rounded bg-muted/40"></div>
                  </div>
                </div>
              {/each}
            </div>
          {:else if rankingError}
            <p class="py-4 text-center text-xs text-destructive">{rankingError}</p>
          {:else}
            <ol class="flex flex-col gap-2.5">
              {#each rankingItems as item, idx (item.anime_id)}
                <li>
                  <button
                    type="button"
                    class="group relative flex w-full items-center justify-between overflow-hidden rounded-xl border border-border/70 bg-[#131722]/85 p-3 text-left shadow-sm backdrop-blur transition-all duration-300 hover:border-primary/60 hover:bg-[#181d2a] hover:shadow-md hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onclick={() => router.go(`/anime/${item.anime_id}`)}
                  >
                    <!-- Background artwork crop on the right with soft fade gradient -->
                    <div class="pointer-events-none absolute inset-y-0 right-0 w-2/5 sm:w-1/2 overflow-hidden">
                      {#if item.banner_image || item.cover_image}
                        <img
                          src={item.banner_image || item.cover_image}
                          alt=""
                          loading="lazy"
                          class="h-full w-full object-cover object-center sm:object-right transition-transform duration-500 ease-out group-hover:scale-110"
                        />
                      {/if}
                      <!-- Linear gradient fade into card background -->
                      <div class="absolute inset-0 bg-gradient-to-r from-[#131722] via-[#131722]/80 to-transparent group-hover:from-[#181d2a] group-hover:via-[#181d2a]/75 transition-colors"></div>
                    </div>

                    <!-- Left Content: Rank Badge + Titles & Subtitle Pills -->
                    <div class="relative z-10 flex items-center gap-3 min-w-0 pr-4">
                      <!-- Rank Circle -->
                      <span
                        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black transition-transform group-hover:scale-105 {
                          idx === 0
                            ? 'border-2 border-amber-400 bg-amber-400/15 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.3)]'
                            : idx === 1
                            ? 'border-2 border-slate-300 bg-slate-300/15 text-slate-100 shadow-[0_0_10px_rgba(203,213,225,0.25)]'
                            : idx === 2
                            ? 'border-2 border-amber-600 bg-amber-600/15 text-amber-400 shadow-[0_0_10px_rgba(217,119,6,0.25)]'
                            : 'border border-border/80 bg-black/40 text-muted-foreground'
                        }"
                      >
                        {idx + 1}
                      </span>

                      <!-- Title and Metadata -->
                      <div class="min-w-0 flex-1">
                        <h4
                          class="truncate text-xs sm:text-sm font-bold tracking-tight text-foreground transition-colors group-hover:text-primary"
                          title={displayTitle(item.title_english, item.title_romaji)}
                        >
                          {displayTitle(item.title_english, item.title_romaji)}
                        </h4>

                        <div class="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                          <!-- Closed Caption / Episodes Badge (CC 4) -->
                          <span class="inline-flex items-center gap-1 rounded border border-orange-500/50 bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-black text-orange-400 tracking-wider">
                            <span class="text-[9px] font-extrabold uppercase">CC</span>
                            <span>{item.latest_episode && item.latest_episode > 0 ? item.latest_episode : 1}</span>
                          </span>

                          <!-- Format Badge (TV / ONA / MOVIE) -->
                          {#if item.format}
                            <span class="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              {item.format}
                            </span>
                          {/if}

                          <!-- Rating Score -->
                          {#if item.score}
                            <span class="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-400">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-2.5 w-2.5" aria-hidden="true">
                                <path fill-rule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z" clip-rule="evenodd" />
                              </svg>
                              {(item.score / 10).toFixed(1)}
                            </span>
                          {/if}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              {/each}
            </ol>
          {/if}
        </div>

        <!-- Weekly Airing Release Schedule with Real-Time Countdown (Image 2) -->
        <WeeklySchedule />
      </aside>
    </div>
  {/if}
</div>
