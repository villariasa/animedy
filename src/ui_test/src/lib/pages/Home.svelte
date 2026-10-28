<script lang="ts">
  import { apiPost, ApiError } from "$lib/api/client";
  import { apiPostCached } from "$lib/api/cached";
  import type {
    AnimeSearchResponse,
    AnimeSearchResultItem,
    ContinueWatchingItem,
    ContinueWatchingListResponse
  } from "$lib/api/types";
  import ContinueWatchingCard from "$lib/components/ContinueWatchingCard.svelte";
  import { displayTitle } from "$lib/format";
  import { router } from "$lib/router.svelte";
  import { auth } from "$lib/stores/auth.svelte";

  type MainCuratedTab = "trending" | "popular";
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

  // Right sidebar ranking tab (Top Rated / Trending)
  let rankingTab = $state<RankingTab>("top_rated");
  let rankingItems = $state<AnimeSearchResultItem[]>([]);
  let rankingLoading = $state(false);
  let rankingError = $state<string | null>(null);

  async function runSearch(q: string): Promise<void> {
    searching = true;
    searchError = null;
    try {
      const res = await apiPostCached<AnimeSearchResponse>("/api/anime/search", { query: q });
      results = res.results;
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

  async function loadCurated(tab: MainCuratedTab): Promise<void> {
    curatedLoading = true;
    curatedError = null;
    try {
      const tag = tab === "trending" ? ":trending" : ":popular";
      const res = await apiPostCached<AnimeSearchResponse>("/api/anime/search", { query: tag });
      curatedItems = res.results;
    } catch (err) {
      curatedError = err instanceof ApiError ? err.message : "Failed to load curated anime.";
    } finally {
      curatedLoading = false;
    }
  }

  async function loadRankings(tab: RankingTab): Promise<void> {
    rankingLoading = true;
    rankingError = null;
    try {
      const tagMap: Record<RankingTab, string> = {
        top_rated: ":top_rated",
        trending: ":trending",
        this_week: ":this_week",
        this_month: ":this_month"
      };
      const tag = tagMap[tab] ?? ":top_rated";
      const res = await apiPostCached<AnimeSearchResponse>("/api/anime/search", { query: tag });
      rankingItems = res.results.slice(0, 10);
    } catch (err) {
      rankingError = err instanceof ApiError ? err.message : "Failed to load rankings.";
    } finally {
      rankingLoading = false;
    }
  }

  $effect(() => {
    void loadCurated(activeTab);
  });

  $effect(() => {
    void loadRankings(rankingTab);
  });

  $effect(() => {
    if (auth.isLoggedIn) {
      void apiPost<ContinueWatchingListResponse>("/api/continue-watching/list")
        .then((res) => {
          continueItems = res.items;
          railError = null;
        })
        .catch((err: unknown) => {
          railError = err instanceof ApiError ? err.message : "Could not load Continue Watching.";
        });
    } else {
      continueItems = [];
    }
  });
</script>

<div class="flex flex-col gap-10">
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

  <!-- Continue watching rail (if logged in) -->
  {#if auth.isLoggedIn && (continueItems.length > 0 || railError)}
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
                    {[item.format, item.season_year].filter(Boolean).join(" · ")}
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
        <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="text-xl font-bold tracking-tight">Popular & Trending</h2>
            <p class="text-xs text-muted-foreground">Top ranked releases updated continuously</p>
          </div>

          <!-- Main tabs -->
          <div class="inline-flex rounded-lg border border-border bg-card/60 p-1 text-xs">
            <button
              type="button"
              class="flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors {activeTab === 'trending' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
              onclick={() => (activeTab = "trending")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.75"
                stroke="currentColor"
                class="h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 0-1.925 3.547 5.975 5.975 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18Z"
                />
              </svg>
              Trending This Week
            </button>

            <button
              type="button"
              class="flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors {activeTab === 'popular' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
              onclick={() => (activeTab = "popular")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.75"
                stroke="currentColor"
                class="h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
                />
              </svg>
              Popular This Month
            </button>
          </div>
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
        {:else}
          <ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5">
            {#each curatedItems as item, index (item.anime_id)}
              <li>
                <button
                  type="button"
                  class="group flex w-full flex-col gap-2 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onclick={() => router.go(`/anime/${item.anime_id}`)}
                >
                  <div class="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-muted shadow-sm ring-1 ring-border/40 transition-all duration-300 group-hover:shadow-md group-hover:ring-primary/60">
                    {#if item.cover_image}
                      <img
                        src={item.cover_image}
                        alt=""
                        loading="lazy"
                        class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    {/if}

                    <!-- Rank badge -->
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

                    <!-- Format pill -->
                    {#if item.format}
                      <span class="absolute top-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur">
                        {item.format}
                      </span>
                    {/if}

                    <div class="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent"></div>
                  </div>

                  <div class="min-w-0">
                    <p class="truncate text-sm font-semibold tracking-tight transition-colors group-hover:text-primary">
                      {displayTitle(item.title_english, item.title_romaji)}
                    </p>
                    <p class="mt-0.5 text-xs text-muted-foreground">
                      {[item.format, item.season_year, item.status ? item.status.toLowerCase() : null].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <!-- Right: Top Rankings Leaderboard List (The Green Box) -->
      <aside class="w-full xl:w-80 2xl:w-96 shrink-0" aria-label="Top Rankings">
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
                <p class="text-[11px] text-muted-foreground">Leaderboard list</p>
              </div>
            </div>
          </div>

          <!-- 4 Rankings Tabs: Top Rated | Trending | This Week | This Month -->
          <div class="mb-3 grid grid-cols-4 gap-1 rounded-lg border border-border/80 bg-background/60 p-1 text-[11px]">
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

          <!-- Rankings List items -->
          {#if rankingLoading}
            <div class="flex flex-col gap-3">
              {#each Array(6) as _, i (i)}
                <div class="flex animate-pulse items-center gap-3 py-1.5">
                  <div class="h-6 w-6 rounded bg-muted/60"></div>
                  <div class="h-14 w-11 rounded-lg bg-muted/60"></div>
                  <div class="flex-1 space-y-1.5">
                    <div class="h-3.5 w-3/4 rounded bg-muted/60"></div>
                    <div class="h-2.5 w-1/2 rounded bg-muted/40"></div>
                  </div>
                </div>
              {/each}
            </div>
          {:else if rankingError}
            <p class="py-4 text-center text-xs text-destructive">{rankingError}</p>
          {:else}
            <ol class="divide-y divide-border/40">
              {#each rankingItems as item, idx (item.anime_id)}
                <li>
                  <button
                    type="button"
                    class="group flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onclick={() => router.go(`/anime/${item.anime_id}`)}
                  >
                    <!-- Rank Number -->
                    <span
                      class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black {
                        idx === 0
                          ? 'bg-amber-400/20 text-amber-400 ring-1 ring-amber-400/40'
                          : idx === 1
                          ? 'bg-slate-300/20 text-slate-300 ring-1 ring-slate-300/40'
                          : idx === 2
                          ? 'bg-amber-700/20 text-amber-500 ring-1 ring-amber-600/40'
                          : 'text-muted-foreground/80'
                      }"
                    >
                      {idx + 1 < 10 ? `0${idx + 1}` : idx + 1}
                    </span>

                    <!-- Thumbnail cover -->
                    <div class="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-muted shadow-sm">
                      {#if item.cover_image}
                        <img
                          src={item.cover_image}
                          alt=""
                          loading="lazy"
                          class="h-full w-full object-cover transition-transform duration-200 group-hover:scale-110"
                        />
                      {/if}
                    </div>

                    <!-- Details -->
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-xs font-semibold tracking-tight transition-colors group-hover:text-primary">
                        {displayTitle(item.title_english, item.title_romaji)}
                      </p>
                      <div class="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        {#if item.format}
                          <span class="rounded bg-muted px-1 py-0.2 text-[10px] font-medium uppercase">
                            {item.format}
                          </span>
                        {/if}
                        {#if item.season_year}
                          <span>{item.season_year}</span>
                        {/if}
                        {#if item.status}
                          <span class="capitalize">· {item.status.toLowerCase()}</span>
                        {/if}
                      </div>
                    </div>

                    <!-- Mini Chevron icon -->
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="2"
                      stroke="currentColor"
                      class="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                      aria-hidden="true"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                </li>
              {/each}
            </ol>
          {/if}
        </div>
      </aside>
    </div>
  {/if}
</div>
