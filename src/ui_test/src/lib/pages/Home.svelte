<script lang="ts">
  import { ApiError } from "$lib/api/client";
  import {
    browseAnime,
    searchAnime,
    getLatestReleases,
    getTrendingSpotlight,
    ANILIST_GENRES,
    type BrowseTag
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
  import { watchStatusStore } from "$lib/stores/watchStatus.svelte";
  import { searchHistory } from "$lib/stores/searchHistory.svelte";
  import HoverSelect, { type SelectOption } from "$lib/components/HoverSelect.svelte";

  type MainCuratedTab = "latest_release" | "trending";
  type RankingTab = "top_rated" | "trending" | "this_week" | "this_month";

  const SEARCH_DEBOUNCE_MS = 400;

  let query = $state("");
  let results = $state<AnimeSearchResultItem[]>([]);
  let searching = $state(false);
  let searchError = $state<string | null>(null);
  let continueItems = $state<ContinueWatchingItem[]>([]);
  let railError = $state<string | null>(null);
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  // Main grid tab — Latest Release (animepahe-style) is the default landing tab.
  let activeTab = $state<MainCuratedTab>("latest_release");
  let curatedItems = $state<AnimeSearchResultItem[]>([]);
  let curatedLoading = $state(false);
  let curatedError = $state<string | null>(null);
  let curatedPage = $state(1);
  let curatedHasMore = $state(false);
  let loadingMore = $state(false);
  // Pins the "now" boundary for a Latest Release paging session so page 2+
  // continues chronologically from page 1 instead of drifting forward in time.
  let latestReleaseAnchorAt = $state(0);
  // Raw AniList airingSchedules page cursor to resume from on the next forward fetch.
  let latestReleaseRawPage = $state(1);
  // Anime ids already shown on an earlier UI page this session — a show's
  // older episodes live on later raw pages, so without this it can resurface
  // with a stale episode after already appearing with its newest one.
  let latestReleaseSeenIds = $state<Set<number>>(new Set());
  // Already-fetched UI pages, so Prev/Next within range is instant and never
  // re-derives a page (which could otherwise shuffle/duplicate results).
  let latestReleasePagesCache = $state<Map<number, AnimeSearchResultItem[]>>(new Map());
  // Whether AniList still has more raw airingSchedules beyond the last page we fetched.
  let latestReleaseHasMoreRaw = $state(false);

  // Discovery filters applied to the curated grid.
  const FORMAT_OPTIONS: AnimeFormat[] = ["TV", "MOVIE", "OVA", "ONA", "SPECIAL", "TV_SHORT", "MUSIC"];
  const YEAR_OPTIONS = Array.from({ length: 35 }, (_, i) => new Date().getFullYear() + 1 - i);
  const genreSelectOptions: SelectOption[] = [
    { value: "", label: "All Genres" },
    ...ANILIST_GENRES.map((g) => ({ value: g, label: g }))
  ];
  const yearSelectOptions: SelectOption[] = [
    { value: "", label: "All Years" },
    ...YEAR_OPTIONS.map((y) => ({ value: String(y), label: String(y) }))
  ];
  const formatSelectOptions: SelectOption[] = [
    { value: "", label: "All Formats" },
    ...FORMAT_OPTIONS.map((f) => ({ value: f, label: f.replace(/_/g, " ") }))
  ];
  let filterGenre = $state("");
  let filterYear = $state("");
  let filterFormat = $state("");
  const filtersActive = $derived(Boolean(filterGenre || filterYear || filterFormat));

  function clearFilters(): void {
    filterGenre = "";
    filterYear = "";
    filterFormat = "";
  }

  const TAB_HEADERS: Record<MainCuratedTab, { title: string; subtitle: string }> = {
    latest_release: { title: "Latest Release", subtitle: "Anime with the most recently aired episode, newest first" },
    trending: { title: "Popular Today", subtitle: "Realtime rankings from AniList activity, updated continuously" }
  };

  // Dedicated Ultra-HD Hero Spotlight items — ranking-based (AniList trending
  // ranking is the source of truth; order is preserved exactly as returned).
  const SPOTLIGHT_COUNT = 8;
  let spotlightItems = $state<AnimeSearchResultItem[]>([]);
  let spotlightLoading = $state(false);

  async function loadSpotlight(): Promise<void> {
    spotlightLoading = true;
    try {
      spotlightItems = await getTrendingSpotlight(SPOTLIGHT_COUNT);
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
    searchHistory.add(q);
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

  function searchFromHistory(q: string): void {
    query = q;
    void runSearch(q);
  }

  // "Surprise Me": prefer a random pick from the user's Plan to Watch list
  // (gives that list a purpose beyond just sitting there); fall back to
  // whatever's already loaded on the page so it never needs an extra fetch.
  function surpriseMe(): void {
    const planToWatch = watchStatusStore.byStatus("plan_to_watch");
    const pool =
      planToWatch.length > 0
        ? planToWatch
        : curatedItems.length > 0
          ? curatedItems
          : spotlightItems;
    if (pool.length === 0) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) {
      router.go(`/anime/${pick.anime_id}`);
    }
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
      activeTab = "latest_release";
    }
  });

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
      if (tab === "latest_release") {
        // Fresh paging session — reset the anchor, seen-id tracking, and page cache
        // so a tab switch never carries over stale state from a previous visit.
        latestReleaseAnchorAt = Math.floor(Date.now() / 1000);
        latestReleaseSeenIds = new Set();
        latestReleasePagesCache = new Map();
        const pageResult = await getLatestReleases(1, latestReleaseAnchorAt, latestReleaseSeenIds, activeFilters());
        curatedItems = pageResult.items;
        for (const item of pageResult.items) latestReleaseSeenIds.add(item.anime_id);
        latestReleasePagesCache.set(1, pageResult.items);
        latestReleaseRawPage = pageResult.nextRawPage;
        latestReleaseHasMoreRaw = pageResult.hasNextPage;
        curatedHasMore = pageResult.hasNextPage;
        return;
      }
      const pageResult = await browseAnime(tab as BrowseTag, 1, activeFilters());
      curatedItems = pageResult.items;
      curatedHasMore = false;
    } catch (err) {
      curatedError = err instanceof ApiError ? err.message : "Failed to load curated anime.";
    } finally {
      curatedLoading = false;
    }
  }

  // "Latest Release" uses true prev/next pagination (animepahe-style), replacing
  // the grid instead of appending to it. Going back to an already-fetched page
  // is instant and reuses the cached result — an anime already shown on an
  // earlier page never resurfaces, since forward fetches exclude every id
  // already seen this session.
  async function goToCuratedPage(pageNum: number): Promise<void> {
    if (pageNum < 1 || loadingMore) return;
    const cached = latestReleasePagesCache.get(pageNum);
    if (cached) {
      curatedItems = cached;
      curatedPage = pageNum;
      // More pages exist if a later one is already cached, or we haven't
      // exhausted AniList's raw feed yet.
      curatedHasMore = latestReleasePagesCache.has(pageNum + 1) || latestReleaseHasMoreRaw;
      return;
    }
    loadingMore = true;
    try {
      const pageResult = await getLatestReleases(
        latestReleaseRawPage,
        latestReleaseAnchorAt,
        latestReleaseSeenIds,
        activeFilters()
      );
      for (const item of pageResult.items) latestReleaseSeenIds.add(item.anime_id);
      latestReleasePagesCache.set(pageNum, pageResult.items);
      latestReleaseRawPage = pageResult.nextRawPage;
      latestReleaseHasMoreRaw = pageResult.hasNextPage;
      curatedItems = pageResult.items;
      curatedPage = pageNum;
      curatedHasMore = pageResult.hasNextPage;
    } catch (err) {
      curatedError = err instanceof ApiError ? err.message : "Failed to load page.";
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

  <!-- Recent search chips -->
  {#if query.trim().length === 0 && searchHistory.items.length > 0}
    <div class="mx-auto -mt-1 flex w-full max-w-xl flex-wrap items-center justify-center gap-1.5">
      <span class="text-[11px] text-muted-foreground">Recent:</span>
      {#each searchHistory.items.slice(0, 5) as q (q)}
        <button
          type="button"
          onclick={() => searchFromHistory(q)}
          class="rounded-full border border-border/70 bg-card/60 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground backdrop-blur transition-colors hover:border-primary/50 hover:text-primary"
        >
          {q}
        </button>
      {/each}
    </div>
  {/if}

  <!-- Surprise Me: random pick, preferring your Plan to Watch list -->
  <div class="flex justify-center -mt-3">
    <button
      type="button"
      onclick={surpriseMe}
      class="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/60 px-3.5 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm backdrop-blur transition-colors hover:border-primary/50 hover:text-primary"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-3.5 w-3.5" aria-hidden="true">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M9 4.5C9.33486 4.5 9.62915 4.72198 9.72114 5.04396L10.5343 7.89015C10.8903 9.13593 11.8641 10.1097 13.1099 10.4657L15.956 11.2789C16.278 11.3709 16.5 11.6651 16.5 12C16.5 12.3349 16.278 12.6291 15.956 12.7211L13.1098 13.5343C11.8641 13.8903 10.8903 14.8641 10.5343 16.1099L9.72114 18.956C9.62915 19.278 9.33486 19.5 9 19.5C8.66514 19.5 8.37085 19.278 8.27886 18.956L7.46566 16.1099C7.10972 14.8641 6.13593 13.8903 4.89015 13.5343L2.04396 12.7211C1.72198 12.6291 1.5 12.3349 1.5 12C1.5 11.6651 1.72198 11.3709 2.04396 11.2789L4.89015 10.4657C6.13593 10.1097 7.10972 9.13593 7.46566 7.89015L8.27886 5.04396C8.37085 4.72198 8.66514 4.5 9 4.5Z" />
        <path fill-rule="evenodd" clip-rule="evenodd" d="M18 1.5C18.3442 1.5 18.6441 1.73422 18.7276 2.0681L18.9865 3.10356C19.2216 4.04406 19.9559 4.7784 20.8964 5.01353L21.9319 5.27239C22.2658 5.35586 22.5 5.65585 22.5 6C22.5 6.34415 22.2658 6.64414 21.9319 6.72761L20.8964 6.98647C19.9559 7.2216 19.2216 7.95594 18.9865 8.89644L18.7276 9.9319C18.6441 10.2658 18.3442 10.5 18 10.5C17.6558 10.5 17.3559 10.2658 17.2724 9.9319L17.0135 8.89644C16.7784 7.95594 16.0441 7.2216 15.1036 6.98647L14.0681 6.72761C13.7342 6.64414 13.5 6.34415 13.5 6C13.5 5.65585 13.7342 5.35586 14.0681 5.27239L15.1036 5.01353C16.0441 4.7784 16.7784 4.04406 17.0135 3.10356L17.2724 2.0681C17.3559 1.73422 17.6558 1.5 18 1.5Z" />
        <path fill-rule="evenodd" clip-rule="evenodd" d="M16.5 15C16.8228 15 17.1094 15.2066 17.2115 15.5128L17.6058 16.6956C17.7551 17.1435 18.1065 17.4949 18.5544 17.6442L19.7372 18.0385C20.0434 18.1406 20.25 18.4272 20.25 18.75C20.25 19.0728 20.0434 19.3594 19.7372 19.4615L18.5544 19.8558C18.1065 20.0051 17.7551 20.3565 17.6058 20.8044L17.2115 21.9872C17.1094 22.2934 16.8228 22.5 16.5 22.5C16.1772 22.5 15.8906 22.2934 15.7885 21.9872L15.3942 20.8044C15.2449 20.3565 14.8935 20.0051 14.4456 19.8558L13.2628 19.4615C12.9566 19.3594 12.75 19.0728 12.75 18.75C12.75 18.4272 12.9566 18.1406 13.2628 18.0385L14.4456 17.6442C14.8935 17.4949 15.2449 17.1435 15.3942 16.6956L15.7885 15.5128C15.8906 15.2066 16.1772 15 16.5 15Z" />
      </svg>
      Surprise Me
    </button>
  </div>

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
              class="flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap {activeTab === 'latest_release'
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25 ring-1 ring-primary/40 font-bold'
                : 'bg-background/90 text-foreground border border-border/80 hover:border-primary/50 hover:bg-accent hover:text-primary shadow-sm'}"
              onclick={() => { activeTab = "latest_release"; query = ""; }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                class="h-4 w-4 shrink-0 {activeTab === 'latest_release' ? 'text-primary-foreground' : 'text-sky-400'}"
                aria-hidden="true"
              >
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .2.08.39.22.53l3 3a.75.75 0 0 0 1.06-1.06l-2.78-2.78V5Z"
                  clip-rule="evenodd"
                />
              </svg>
              <span>Latest Release</span>
            </button>

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
          </div>
        </div>

        <!-- Discovery Filters: Genre / Year / Format (hover to open) -->
        <div class="mb-6 flex flex-wrap items-center gap-2">
          <HoverSelect
            bind:value={filterGenre}
            options={genreSelectOptions}
            placeholder="All Genres"
            triggerClass="w-36 bg-card/90 backdrop-blur"
          />
          <HoverSelect
            bind:value={filterYear}
            options={yearSelectOptions}
            placeholder="All Years"
            triggerClass="w-28 bg-card/90 backdrop-blur"
          />
          <HoverSelect
            bind:value={filterFormat}
            options={formatSelectOptions}
            placeholder="All Formats"
            triggerClass="w-32 bg-card/90 backdrop-blur"
          />

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

                    <!-- Rank badge (animepahe's Latest Release feed has no rank ribbon — title + episode count only) -->
                    {#if activeTab !== 'latest_release'}
                      <span
                        class="absolute top-2 left-2 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold shadow-md backdrop-blur {
                          index === 0
                            ? 'bg-amber-400 text-amber-950 ring-2 ring-amber-200'
                            : index === 1
                            ? 'bg-slate-200 text-slate-900 ring-2 ring-slate-100'
                            : index === 2
                            ? 'bg-amber-700 text-amber-100 ring-2 ring-amber-600'
                            : 'bg-black/75 text-white'
                        }"
                      >
                        #{index + 1}
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

          {#if activeTab === "latest_release"}
            <!-- animepahe-style prev/next pager -->
            <div class="mt-6 flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={curatedPage <= 1 || loadingMore}
                class="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card/60 text-sm font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                onclick={() => void goToCuratedPage(curatedPage - 1)}
                aria-label="Previous page"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4" aria-hidden="true">
                  <path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z" clip-rule="evenodd" />
                </svg>
              </button>
              <span class="flex h-9 min-w-9 items-center justify-center rounded-lg bg-primary px-3 text-sm font-bold text-primary-foreground shadow-sm">
                {#if loadingMore}
                  <span class="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"></span>
                {:else}
                  {curatedPage}
                {/if}
              </span>
              <button
                type="button"
                disabled={!curatedHasMore || loadingMore}
                class="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card/60 text-sm font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                onclick={() => void goToCuratedPage(curatedPage + 1)}
                aria-label="Next page"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4" aria-hidden="true">
                  <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clip-rule="evenodd" />
                </svg>
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
