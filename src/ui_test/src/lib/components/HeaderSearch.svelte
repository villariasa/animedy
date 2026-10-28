<script lang="ts">
  import { searchAnime } from "$lib/api/anilist";
  import type { AnimeSearchResultItem } from "$lib/api/types";
  import { displayTitle } from "$lib/format";
  import { router } from "$lib/router.svelte";

  let { isSearchActive = $bindable(false) }: { isSearchActive?: boolean } = $props();

  const DEBOUNCE_MS = 280;

  let query = $state("");
  let results = $state<AnimeSearchResultItem[]>([]);
  let searching = $state(false);
  let isOpen = $state(false);
  let isFocused = $state(false);
  let activeIndex = $state(-1);
  let containerRef = $state<HTMLDivElement | null>(null);
  let inputRef = $state<HTMLInputElement | null>(null);

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    isSearchActive = isFocused || isOpen || query.trim().length > 0;
  });

  function stripHtml(html: string | null | undefined): string {
    if (!html) return "";
    return html
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/&#039;/g, "'")
      .trim();
  }

  async function performSearch(q: string): Promise<void> {
    searching = true;
    try {
      const items = await searchAnime(q);
      // Limit to top 7 most relevant suggestions for a clean dropdown
      results = items.slice(0, 7);
      isOpen = results.length > 0 || q.length >= 2;
      activeIndex = -1;
    } catch {
      results = [];
      isOpen = q.length >= 2;
    } finally {
      searching = false;
    }
  }

  function onInput(): void {
    clearTimeout(debounceTimer);
    const q = query.trim();
    if (q.length >= 2) {
      searching = true;
      debounceTimer = setTimeout(() => void performSearch(q), DEBOUNCE_MS);
    } else {
      results = [];
      isOpen = false;
      searching = false;
    }
  }

  function onFocus(): void {
    isFocused = true;
    if (query.trim().length >= 2) {
      isOpen = true;
    }
  }

  function clearSearch(): void {
    query = "";
    results = [];
    isOpen = false;
    activeIndex = -1;
    inputRef?.focus();
  }

  function closeSearch(): void {
    isOpen = false;
    isFocused = false;
    activeIndex = -1;
    inputRef?.blur();
  }

  function selectItem(item: AnimeSearchResultItem): void {
    closeSearch();
    query = "";
    router.go(`/anime/${item.anime_id}`);
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (!isOpen) {
      if (e.key === "ArrowDown" && query.trim().length >= 2) {
        isOpen = true;
      }
      return;
    }

    if (e.key === "Escape") {
      closeSearch();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = activeIndex < results.length - 1 ? activeIndex + 1 : 0;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = activeIndex > 0 ? activeIndex - 1 : results.length - 1;
    } else if (e.key === "Enter") {
      const item = results[activeIndex];
      if (item) {
        e.preventDefault();
        selectItem(item);
      }
    }
  }

  $effect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent): void {
      if (containerRef && !containerRef.contains(event.target as Node)) {
        isOpen = false;
        isFocused = false;
      }
    }
    document.addEventListener("click", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  });
</script>

<div bind:this={containerRef} class="relative w-full">
  <!-- Search Input Container -->
  <div class="relative flex items-center">
    <!-- Back arrow button visible on mobile when search is expanded -->
    {#if isSearchActive}
      <button
        type="button"
        onclick={closeSearch}
        class="mr-1.5 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:hidden shrink-0"
        aria-label="Back / Close search"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
          <path fill-rule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clip-rule="evenodd" />
        </svg>
      </button>
    {/if}

    <div class="relative flex-1 flex items-center min-w-0">
      <!-- Search Icon -->
      <span class="pointer-events-none absolute left-3 flex items-center text-muted-foreground/70">
        {#if searching}
          <svg class="h-4 w-4 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-4 w-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        {/if}
      </span>

      <input
        bind:this={inputRef}
        type="text"
        bind:value={query}
        oninput={onInput}
        onfocus={onFocus}
        onkeydown={onKeyDown}
        placeholder="Search anime..."
        class="h-9 w-full rounded-full border border-border/80 bg-muted/40 pl-9 pr-8 text-xs text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-primary/70 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
        autocomplete="off"
        spellcheck="false"
        id="header-search-input"
        role="combobox"
        aria-label="Search anime"
        aria-expanded={isOpen}
        aria-controls="header-search-listbox"
        aria-haspopup="listbox"
      />

      {#if query.length > 0}
        <button
          type="button"
          onclick={clearSearch}
          class="absolute right-2.5 flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Clear search"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      {/if}
    </div>
  </div>

  <!-- Suggestion Dropdown Menu -->
  {#if isOpen}
    <!-- Mobile backdrop for easy dismissal -->
    <button
      type="button"
      class="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] sm:hidden"
      onclick={closeSearch}
      tabindex="-1"
      aria-label="Dismiss search results"
    ></button>

    <div
      id="header-search-listbox"
      class="fixed inset-x-2 top-[54px] sm:absolute sm:inset-x-0 sm:top-full z-50 mt-1 sm:mt-1.5 max-h-[calc(100dvh-70px)] sm:max-h-[460px] overflow-y-auto rounded-xl border border-border/80 bg-card/98 p-1.5 shadow-2xl backdrop-blur-xl transition-all animate-in fade-in zoom-in-95 duration-100"
      role="listbox"
    >
      {#if searching && results.length === 0}
        <div class="flex items-center justify-center py-6 text-xs text-muted-foreground">
          <svg class="mr-2 h-4 w-4 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Searching anime database...
        </div>
      {:else if results.length === 0}
        <div class="py-6 text-center text-xs text-muted-foreground">
          No anime found for "<span class="font-medium text-foreground">{query}</span>"
        </div>
      {:else}
        <div class="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Suggestions ({results.length})
        </div>
        <ul class="flex flex-col gap-0.5">
          {#each results as item, index (item.anime_id)}
            <li>
              <button
                type="button"
                onclick={() => selectItem(item)}
                class="group flex w-full items-start gap-3 rounded-lg p-2 text-left transition-colors {activeIndex === index ? 'bg-primary/15 text-primary' : 'hover:bg-accent/80 active:bg-accent text-foreground'}"
                role="option"
                aria-selected={activeIndex === index}
              >
                <!-- Preview Cover Image -->
                <div class="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-muted shadow-sm">
                  {#if item.cover_image}
                    <img
                      src={item.cover_image}
                      alt={displayTitle(item.title_english, item.title_romaji)}
                      class="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                      loading="lazy"
                    />
                  {:else}
                    <div class="flex h-full w-full items-center justify-center bg-muted text-[10px] text-muted-foreground">
                      No img
                    </div>
                  {/if}
                </div>

                <!-- Anime Info: Title, Badges & Description -->
                <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div class="flex items-center gap-1.5">
                    <span class="truncate text-xs font-semibold leading-tight {activeIndex === index ? 'text-primary' : 'text-foreground group-hover:text-primary'}">
                      {displayTitle(item.title_english, item.title_romaji)}
                    </span>
                  </div>

                  <!-- Metadata Badges -->
                  <div class="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                    {#if item.format}
                      <span class="rounded bg-muted px-1.5 py-0.5 font-medium uppercase">
                        {item.format}
                      </span>
                    {/if}
                    {#if item.season_year}
                      <span>{item.season_year}</span>
                    {/if}
                    {#if item.status}
                      <span class="capitalize text-muted-foreground/80">• {item.status.toLowerCase().replace(/_/g, " ")}</span>
                    {/if}
                  </div>

                  <!-- Description Snippet -->
                  {#if item.description}
                    <p class="line-clamp-2 text-[11px] leading-snug text-muted-foreground/80">
                      {stripHtml(item.description)}
                    </p>
                  {/if}
                </div>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</div>
