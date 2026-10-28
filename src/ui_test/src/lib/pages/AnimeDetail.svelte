<script lang="ts">
  import { apiPost, ApiError } from "$lib/api/client";
  import type {
    AnimeDetails,
    AnimeDetailsResponse,
    AnimeFranchiseResponse,
    EpisodeListItem,
    EpisodesListResponse,
    FranchiseEntry,
    WatchNextGetResponse
  } from "$lib/api/types";
  import { Button } from "$lib/components/ui/button";
  import { displayTitle, stripHtml } from "$lib/format";
  import { router } from "$lib/router.svelte";
  import { auth } from "$lib/stores/auth.svelte";

  let { animeId }: { animeId: number } = $props();

  let anime = $state<AnimeDetails | null>(null);
  let franchise = $state<FranchiseEntry[]>([]);
  let episodes = $state<EpisodeListItem[]>([]);
  let watchNext = $state<WatchNextGetResponse | null>(null);
  let error = $state<string | null>(null);
  let loading = $state(true);

  const title = $derived(anime ? displayTitle(anime.title_english, anime.title_romaji) : "");
  const metaLine = $derived(
    anime
      ? [
          anime.format,
          anime.season && anime.season_year ? `${anime.season} ${anime.season_year}` : anime.season_year,
          anime.episode_count ? `${anime.episode_count} eps` : null,
          anime.episode_duration ? `${anime.episode_duration} min` : null,
          anime.status
        ]
          .filter(Boolean)
          .join(" · ")
      : ""
  );

  $effect(() => {
    void load(animeId);
  });

  async function load(id: number): Promise<void> {
    loading = true;
    error = null;
    anime = null;
    franchise = [];
    episodes = [];
    watchNext = null;
    try {
      const details = await apiPost<AnimeDetailsResponse>("/api/anime/details", { anime_id: id });
      anime = details.anime;
      const [franchiseRes, episodesRes] = await Promise.all([
        apiPost<AnimeFranchiseResponse>("/api/anime/franchise", { anime_id: id }).catch(() => null),
        apiPost<EpisodesListResponse>("/api/episodes/list", { anime_id: id }).catch(() => null)
      ]);
      franchise = franchiseRes?.entries ?? [];
      episodes = episodesRes?.episodes ?? [];
      if (auth.isLoggedIn) {
        watchNext = await apiPost<WatchNextGetResponse>("/api/watch-next/get", { anime_id: id }).catch(
          () => null
        );
      }
    } catch (err) {
      error = err instanceof ApiError ? err.message : "Failed to load anime.";
    } finally {
      loading = false;
    }
  }
</script>

{#if loading}
  <p class="py-16 text-center text-sm text-muted-foreground">Loading…</p>
{:else if error}
  <p class="py-16 text-center text-sm text-destructive">{error}</p>
{:else if anime}
  <div class="flex flex-col gap-8">
    {#if anime.banner_image}
      <img src={anime.banner_image} alt="" class="max-h-56 w-full rounded-lg object-cover" />
    {/if}

    <section class="flex flex-col gap-4 sm:flex-row">
      {#if anime.cover_image}
        <img src={anime.cover_image} alt="" class="w-40 shrink-0 self-start rounded-lg" />
      {/if}
      <div class="min-w-0 flex-1">
        <h2 class="text-2xl font-semibold">{title}</h2>
        <p class="mt-0.5 text-sm text-muted-foreground">
          {[anime.title_romaji, anime.title_native].filter((t) => t && t !== title).join(" · ")}
        </p>
        <p class="mt-2 text-sm text-muted-foreground">{metaLine}</p>
        {#if anime.season_label || anime.arc_name}
          <p class="mt-1 text-sm">
            {[anime.season_label, anime.arc_name].filter(Boolean).join(" — ")}
          </p>
        {/if}
        {#if anime.start_date}
          <p class="mt-1 text-xs text-muted-foreground">
            Aired {anime.start_date}{anime.end_date ? ` → ${anime.end_date}` : ""}
          </p>
        {/if}
        {#if anime.description}
          <p class="mt-3 max-w-prose whitespace-pre-line text-sm leading-relaxed text-foreground/90">
            {stripHtml(anime.description)}
          </p>
        {/if}
      </div>
    </section>

    {#if watchNext && watchNext.type !== "NONE" && watchNext.episode}
      <section
        class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/10 p-4"
        aria-label="Watch next"
      >
        <div class="min-w-0">
          <p class="text-xs font-medium uppercase tracking-wide text-primary">Watch next</p>
          <p class="truncate text-sm">
            {watchNext.anime ? displayTitle(watchNext.anime.title_english, watchNext.anime.title_romaji) : title}
            — Episode {watchNext.episode.episode_number}
            {watchNext.episode.title ? `· ${watchNext.episode.title}` : ""}
          </p>
          <p class="text-xs text-muted-foreground">{watchNext.reason}</p>
        </div>
        <Button
          onclick={() =>
            router.go(`/watch/${watchNext?.anime?.anime_id ?? anime?.id}/${watchNext?.episode?.episode_id}`)}
        >
          {watchNext.type === "RESUME" ? "Resume" : "Watch Next"}
        </Button>
      </section>
    {/if}

    {#if franchise.length > 1}
      <section aria-label="Franchise timeline">
        <h3 class="mb-3 text-lg font-semibold">Franchise</h3>
        <ol class="flex gap-3 overflow-x-auto pb-2">
          {#each franchise as entry (entry.anime_id)}
            <li>
              <button
                type="button"
                class="flex w-48 flex-col gap-1 rounded-lg border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring {entry.anime_id === anime.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card hover:bg-accent'}"
                onclick={() => router.go(`/anime/${entry.anime_id}`)}
              >
                <span class="text-xs text-muted-foreground">
                  #{entry.sequence_order ?? "?"} · {entry.format ?? ""}
                </span>
                <span class="line-clamp-2 text-sm font-medium">
                  {displayTitle(entry.title_english, entry.title_romaji)}
                </span>
                <span class="text-xs text-muted-foreground">
                  {[entry.season_label, entry.episode_count ? `${entry.episode_count} eps` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
            </li>
          {/each}
        </ol>
      </section>
    {/if}

    <section aria-label="Episodes">
      <h3 class="mb-3 text-lg font-semibold">Episodes</h3>
      {#if episodes.length === 0}
        <p class="text-sm text-muted-foreground">No episodes registered yet.</p>
      {:else}
        <ul class="divide-y divide-border rounded-lg border border-border">
          {#each episodes as ep (ep.episode_id)}
            <li>
              <button
                type="button"
                class="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onclick={() => router.go(`/watch/${anime?.id}/${ep.episode_id}`)}
              >
                <span class="w-10 shrink-0 text-sm text-muted-foreground">#{ep.episode_number}</span>
                <span class="min-w-0 flex-1 truncate text-sm">{ep.title ?? `Episode ${ep.episode_number}`}</span>
                {#if ep.duration_seconds}
                  <span class="shrink-0 text-xs text-muted-foreground">
                    {Math.round(ep.duration_seconds / 60)} min
                  </span>
                {/if}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  </div>
{/if}
