<script lang="ts">
  import { getAllLocalProgress, type LocalProgress } from "$lib/db/local";
  import { likes } from "$lib/stores/likes.svelte";
  import { watchStatusStore, WATCH_STATUS_LABELS, WATCH_STATUS_ORDER } from "$lib/stores/watchStatus.svelte";

  let progress = $state<LocalProgress[]>([]);

  $effect(() => {
    void getAllLocalProgress().then((rows) => (progress = rows));
  });

  const episodesWatched = $derived(progress.filter((r) => r.completed).length);
  const animeStarted = $derived(new Set(progress.map((r) => r.anime_id)).size);
  const totalMinutes = $derived(
    Math.round(
      progress.reduce((sum, r) => sum + (r.completed ? r.duration_seconds : r.position_seconds), 0) / 60
    )
  );
  const totalHours = $derived(Math.floor(totalMinutes / 60));
  const remainderMinutes = $derived(totalMinutes % 60);

  const STAT_CARDS = $derived([
    { label: "Episodes Watched", value: episodesWatched, icon: "play" },
    { label: "Anime Started", value: animeStarted, icon: "collection" },
    { label: "Completed", value: watchStatusStore.countFor("completed"), icon: "check" },
    { label: "Liked", value: likes.count, icon: "heart" }
  ]);
</script>

<div class="flex flex-col gap-6 max-w-3xl">
  <!-- Header -->
  <div class="flex items-center gap-3.5 border-b border-border/80 pb-5">
    <span class="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/25 ring-2 ring-amber-500/30">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor" class="h-6 w-6" aria-hidden="true">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.003 0H9.497m5.003 0a3.375 3.375 0 0 0 3.375-3.375V6.75A2.25 2.25 0 0 0 15.625 4.5h-7.25A2.25 2.25 0 0 0 6.125 6.75v5.25a3.375 3.375 0 0 0 3.375 3.375Z"
        />
      </svg>
    </span>
    <div>
      <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">Your Stats</h1>
      <p class="text-xs sm:text-sm font-medium text-slate-300 mt-0.5">A snapshot of your watching, from this device's local history.</p>
    </div>
  </div>

  <!-- Headline watch time -->
  <div class="rounded-2xl border border-border/80 bg-gradient-to-br from-primary/15 via-card/70 to-card/70 p-6 shadow-xl backdrop-blur-xl text-center">
    <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total watch time</p>
    <p class="mt-1 text-4xl sm:text-5xl font-black tracking-tight text-foreground">
      {totalHours}<span class="text-xl font-bold text-muted-foreground">h</span>
      {remainderMinutes}<span class="text-xl font-bold text-muted-foreground">m</span>
    </p>
  </div>

  <!-- Stat cards -->
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
    {#each STAT_CARDS as card (card.label)}
      <div class="rounded-2xl border border-border/80 bg-card/70 p-4 text-center shadow-sm backdrop-blur-xl">
        <p class="text-2xl font-black tracking-tight text-foreground">{card.value}</p>
        <p class="mt-1 text-[11px] font-medium text-muted-foreground">{card.label}</p>
      </div>
    {/each}
  </div>

  <!-- Breakdown by watch status -->
  <section class="rounded-2xl border border-border/80 bg-card/70 p-5 sm:p-6 shadow-xl backdrop-blur-xl">
    <h2 class="text-sm font-bold tracking-tight text-foreground mb-4">My List Breakdown</h2>
    {#if watchStatusStore.count === 0}
      <p class="text-xs text-muted-foreground">Set a watch status on any anime to see a breakdown here.</p>
    {:else}
      <div class="flex flex-col gap-3">
        {#each WATCH_STATUS_ORDER as status (status)}
          {@const n = watchStatusStore.countFor(status)}
          {@const pct = watchStatusStore.count > 0 ? Math.round((n / watchStatusStore.count) * 100) : 0}
          <div class="flex items-center gap-3">
            <span class="w-28 shrink-0 text-xs font-medium text-foreground">{WATCH_STATUS_LABELS[status]}</span>
            <div class="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div class="h-full rounded-full bg-primary transition-all" style="width: {pct}%"></div>
            </div>
            <span class="w-8 shrink-0 text-right text-xs font-semibold text-muted-foreground tabular-nums">{n}</span>
          </div>
        {/each}
      </div>
    {/if}
  </section>
</div>
