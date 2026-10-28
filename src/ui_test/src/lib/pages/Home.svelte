<script lang="ts">
  import { apiPost, ApiError } from "$lib/api/client";
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

  const SEARCH_DEBOUNCE_MS = 400;

  let query = $state("");
  let results = $state<AnimeSearchResultItem[]>([]);
  let searching = $state(false);
  let searchError = $state<string | null>(null);
  let continueItems = $state<ContinueWatchingItem[]>([]);
  let railError = $state<string | null>(null);
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  async function runSearch(q: string): Promise<void> {
    searching = true;
    searchError = null;
    try {
      const res = await apiPost<AnimeSearchResponse>("/api/anime/search", { query: q });
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
  <search>
    <label class="mx-auto flex max-w-xl flex-col gap-1" aria-label="Anime search">
      <input
        type="search"
        placeholder="Search anime…"
        bind:value={query}
        oninput={onQueryInput}
        class="h-11 rounded-lg border border-input bg-background px-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </label>
  </search>

  {#if auth.isLoggedIn && (continueItems.length > 0 || railError)}
    <section aria-label="Continue watching">
      <h2 class="mb-3 text-lg font-semibold">Continue Watching</h2>
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

  <section aria-label="Search results">
    {#if searching}
      <p class="text-sm text-muted-foreground">Searching…</p>
    {:else if searchError}
      <p class="text-sm text-destructive">{searchError}</p>
    {:else if results.length > 0}
      <ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {#each results as item (item.anime_id)}
          <li>
            <button
              type="button"
              class="group flex w-full flex-col gap-2 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onclick={() => router.go(`/anime/${item.anime_id}`)}
            >
              <div class="aspect-[2/3] w-full overflow-hidden rounded-lg bg-muted">
                {#if item.cover_image}
                  <img
                    src={item.cover_image}
                    alt=""
                    loading="lazy"
                    class="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                {/if}
              </div>
              <div class="min-w-0">
                <p class="truncate text-sm font-medium">
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
    {:else if query.trim().length >= 2}
      <p class="text-sm text-muted-foreground">No results.</p>
    {/if}
  </section>
</div>
