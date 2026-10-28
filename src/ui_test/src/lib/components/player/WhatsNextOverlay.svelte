<script lang="ts">
  import type { WatchNextGetResponse, WatchNextType } from "$lib/api/types";
  import { Button } from "$lib/components/ui/button";
  import { displayTitle } from "$lib/format";

  let {
    watchNext,
    onwatch,
    onclose
  }: {
    watchNext: WatchNextGetResponse;
    onwatch: () => void;
    onclose: () => void;
  } = $props();

  const TYPE_LABELS: Record<WatchNextType, string> = {
    RESUME: "Resume",
    NEXT_EPISODE: "Next Episode",
    NEXT_SEASON: "Next Season",
    SEQUEL: "Sequel Series",
    MOVIE: "Related Movie",
    SPECIAL_OR_OVA: "Specials & OVAs",
    RECOMMENDATION: "From the same franchise",
    NONE: ""
  };

  const animeTitle = $derived(
    watchNext.anime ? displayTitle(watchNext.anime.title_english, watchNext.anime.title_romaji) : ""
  );
</script>

<div
  class="absolute inset-0 z-20 flex items-center justify-center bg-black/80"
  role="alertdialog"
  aria-label="What's next?"
>
  <div class="flex w-96 max-w-full flex-col items-center gap-4 rounded-lg border border-border bg-card p-6 text-center">
    <p class="text-xs font-medium uppercase tracking-wide text-primary">What's next?</p>
    {#if watchNext.type === "NONE" || !watchNext.episode}
      <p class="text-sm">You're all caught up — nothing left in this franchise.</p>
      <Button variant="outline" onclick={onclose}>Close</Button>
    {:else}
      <div>
        <p class="text-sm text-muted-foreground">{TYPE_LABELS[watchNext.type]}</p>
        <p class="mt-1 text-lg font-semibold">{animeTitle}</p>
        <p class="text-sm text-muted-foreground">
          Episode {watchNext.episode.episode_number}
          {watchNext.episode.title ? `· ${watchNext.episode.title}` : ""}
          {#if watchNext.anime?.season_label}· {watchNext.anime.season_label}{/if}
        </p>
        {#if watchNext.reason}
          <p class="mt-2 text-xs text-muted-foreground">{watchNext.reason}</p>
        {/if}
      </div>
      <div class="flex gap-2">
        <Button onclick={onwatch}>Watch Next</Button>
        <Button variant="outline" onclick={onclose}>Not now</Button>
      </div>
    {/if}
  </div>
</div>
