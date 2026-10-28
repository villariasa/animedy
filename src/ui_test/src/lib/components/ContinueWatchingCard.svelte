<script lang="ts">
  import type { ContinueWatchingItem } from "$lib/api/types";
  import { Button } from "$lib/components/ui/button";
  import { displayTitle, formatRemaining } from "$lib/format";
  import { router } from "$lib/router.svelte";

  let { item }: { item: ContinueWatchingItem } = $props();

  const title = $derived(displayTitle(item.title_english, item.title_romaji));
  const percent = $derived(Math.min(100, Math.max(0, item.progress_percent)));
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
    <Button size="sm" onclick={() => router.go(`/watch/${item.anime_id}/${item.episode_id}`)}>
      Continue
    </Button>
  </footer>
</article>
