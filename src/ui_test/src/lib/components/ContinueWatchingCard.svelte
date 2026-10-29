<script lang="ts">
  import type { ContinueWatchingItem } from "$lib/api/types";
  import { Button } from "$lib/components/ui/button";
  import { displayTitle, formatRemaining } from "$lib/format";
  import { router } from "$lib/router.svelte";
  import { watchStatusStore } from "$lib/stores/watchStatus.svelte";

  let { item }: { item: ContinueWatchingItem } = $props();

  const title = $derived(displayTitle(item.title_english, item.title_romaji));
  const percent = $derived(Math.min(100, Math.max(0, item.progress_percent)));
  const status = $derived(watchStatusStore.getStatus(item.anime_id));

  function markWatching(): void {
    watchStatusStore.setStatus(
      {
        anime_id: item.anime_id,
        title_english: item.title_english,
        title_romaji: item.title_romaji
      },
      "watching"
    );
  }
</script>

<article class="flex w-64 shrink-0 flex-col gap-2 rounded-lg border border-border bg-card p-3">
  <header class="min-w-0">
    <h3 class="truncate text-sm font-medium" {title}>{title}</h3>
    <p class="truncate text-xs text-muted-foreground">
      {#if item.season_label}{item.season_label} · {/if}Episode {item.episode_number}
    </p>
  </header>
  <div
    class="h-1.5 w-full overflow-hidden rounded-full bg-muted"
    role="progressbar"
    aria-valuenow={Math.round(percent)}
    aria-valuemin="0"
    aria-valuemax="100"
    aria-label="Watch progress"
  >
    <div class="h-full rounded-full bg-primary" style="width: {percent}%"></div>
  </div>
  <footer class="flex items-center justify-between gap-2">
    <span class="text-xs text-muted-foreground">
      {Math.round(percent)}% · {formatRemaining(item.remaining_seconds)}
    </span>
    <Button size="sm" onclick={() => router.go(`/watch/${item.anime_id}/${item.episode_number}`)}>
      Continue
    </Button>
  </footer>

  <!-- Nudge: you're watching this but it's not on your list yet -->
  {#if !status}
    <button
      type="button"
      onclick={markWatching}
      class="inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary/40 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5" aria-hidden="true">
        <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
      </svg>
      Add to My List
    </button>
  {/if}
</article>
