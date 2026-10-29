<script lang="ts">
  import { browseAnime } from "$lib/api/anilist";
  import type { AnimeSearchResultItem } from "$lib/api/types";
  import { displayTitle } from "$lib/format";
  import { router } from "$lib/router.svelte";

  let { title = "Trending right now" }: { title?: string } = $props();

  let items = $state<AnimeSearchResultItem[]>([]);

  $effect(() => {
    void browseAnime("trending")
      .then((page) => (items = page.items.slice(0, 6)))
      .catch(() => (items = []));
  });
</script>

{#if items.length > 0}
  <div class="mt-8 w-full">
    <p class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
    <div class="grid grid-cols-3 gap-3 sm:grid-cols-6">
      {#each items as item (item.anime_id)}
        <button
          type="button"
          class="group flex flex-col gap-1.5 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onclick={() => router.go(`/anime/${item.anime_id}`)}
        >
          <div class="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-muted shadow-sm ring-1 ring-border/40 transition-all group-hover:ring-primary/60">
            {#if item.cover_image}
              <img
                src={item.cover_image}
                alt=""
                loading="lazy"
                class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            {/if}
          </div>
          <p class="truncate text-[11px] font-medium text-foreground transition-colors group-hover:text-primary">
            {displayTitle(item.title_english, item.title_romaji)}
          </p>
        </button>
      {/each}
    </div>
  </div>
{/if}
