<script lang="ts">
  import { likes } from "$lib/stores/likes.svelte";
  import { displayTitle } from "$lib/format";
  import { router } from "$lib/router.svelte";
  import { Button } from "$lib/components/ui/button";

  let searchQuery = $state("");

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
  <div class="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
    <div class="flex items-center gap-2.5">
      <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/15 text-rose-500">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-5 w-5" aria-hidden="true">
          <path d="m9.653 16.915-.005-.003-.019-.01a20.759 20.759 0 0 1-1.16-1.107 20.373 20.373 0 0 1-3.69-4.836A7.472 7.472 0 0 1 4 7.5C4 4.462 6.462 2 9.5 2a5.498 5.498 0 0 1 4.298 2.043A5.498 5.498 0 0 1 18.5 7.5c0 1.258-.337 2.44-.925 3.46a20.373 20.373 0 0 1-3.69 4.836 20.758 20.758 0 0 1-1.16 1.107l-.02.01-.005.003h-.002a.75.75 0 0 1-.698 0l-.002-.003Z" />
        </svg>
      </span>
      <div>
        <h2 class="text-2xl font-bold tracking-tight">Liked Anime</h2>
        <p class="text-xs text-muted-foreground">Your saved collection of loved series ({likes.count})</p>
      </div>
    </div>

    {#if likes.items.length > 0}
      <div class="w-full sm:w-64">
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Filter liked anime…"
          class="h-9 w-full rounded-lg border border-input bg-card px-3 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
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
        <div class="group relative flex flex-col gap-2 rounded-xl text-left">
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

            {#if item.format}
              <span class="absolute top-2 left-2 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
                {item.format}
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
          <div class="min-w-0">
            <button
              type="button"
              class="truncate text-left text-sm font-semibold tracking-tight transition-colors hover:text-primary"
              onclick={() => router.go(`/anime/${item.anime_id}`)}
            >
              {displayTitle(item.title_english, item.title_romaji)}
            </button>
            <p class="mt-0.5 text-xs text-muted-foreground">
              {[item.format, item.season_year].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
