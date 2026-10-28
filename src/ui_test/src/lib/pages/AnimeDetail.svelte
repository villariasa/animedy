<script lang="ts">
  import { ApiError } from "$lib/api/client";
  import { buildEpisodes, getAnimeDetails, getFranchise } from "$lib/api/anilist";
  import type { AnimeDetails, EpisodeListItem, FranchiseEntry } from "$lib/api/types";
  import { Button } from "$lib/components/ui/button";
  import { getLocalWatchNext, type LocalWatchNext } from "$lib/continuation";
  import { displayTitle, stripHtml } from "$lib/format";
  import { router } from "$lib/router.svelte";
  import { likes } from "$lib/stores/likes.svelte";

  let { animeId }: { animeId: number } = $props();

  let anime = $state<AnimeDetails | null>(null);
  let franchise = $state<FranchiseEntry[]>([]);
  let episodes = $state<EpisodeListItem[]>([]);
  let watchNext = $state<LocalWatchNext | null>(null);
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
    const id = animeId;
    if (Number.isFinite(id) && id > 0) {
      loadAnime(id);
    }
  });

  async function loadAnime(id: number): Promise<void> {
    loading = true;
    error = null;
    try {
      anime = await getAnimeDetails(id);
      episodes = buildEpisodes(anime);
      franchise = await getFranchise(id).catch(() => []);
      watchNext = await getLocalWatchNext(id, anime.episode_count, franchise).catch(() => null);
    } catch (err) {
      error = err instanceof ApiError ? err.message : "Failed to load anime.";
    } finally {
      loading = false;
    }
  }
</script>

{#if loading}
  <div class="flex flex-col items-center justify-center py-24">
    <div class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
    <p class="mt-3 text-sm text-muted-foreground">Loading anime details…</p>
  </div>
{:else if error}
  <p class="py-16 text-center text-sm text-destructive">{error}</p>
{:else if anime}
  <div class="flex flex-col gap-8">
    <!-- Header Banner Image Preview -->
    {#if anime.banner_image}
      <div class="relative max-h-72 w-full overflow-hidden rounded-2xl shadow-lg ring-1 ring-border/40">
        <img src={anime.banner_image} alt="" class="h-full w-full object-cover" />
        <div class="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent"></div>
      </div>
    {/if}

    <section class="flex flex-col gap-6 sm:flex-row">
      <!-- Poster Box Preview with Glow and Quality Tag -->
      {#if anime.cover_image}
        <div class="relative w-44 shrink-0 overflow-hidden rounded-xl shadow-xl ring-1 ring-border/60 group">
          <img src={anime.cover_image} alt="" class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
          {#if anime.format}
            <span class="absolute top-2 left-2 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
              {anime.format}
            </span>
          {/if}
        </div>
      {/if}
      <div class="min-w-0 flex-1">
        <h2 class="text-3xl font-bold tracking-tight">{title}</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          {[anime.title_romaji, anime.title_native].filter((t) => t && t !== title).join(" · ")}
        </p>
        <p class="mt-2 text-sm text-muted-foreground">{metaLine}</p>
        {#if anime.season_label || anime.arc_name}
          <p class="mt-1 text-sm font-medium">
            {[anime.season_label, anime.arc_name].filter(Boolean).join(" — ")}
          </p>
        {/if}
        {#if anime.start_date}
          <p class="mt-1 text-xs text-muted-foreground">
            Aired {anime.start_date}{anime.end_date ? ` → ${anime.end_date}` : ""}
          </p>
        {/if}
        {#if anime.description}
          <p class="mt-4 max-w-prose whitespace-pre-line text-sm leading-relaxed text-foreground/90">
            {stripHtml(anime.description)}
          </p>
        {/if}

        <!-- Quick Action Buttons -->
        <div class="mt-5 flex flex-wrap items-center gap-3">
          {#if episodes.length > 0}
            <Button
              class="gap-2 shadow-lg"
              onclick={() => episodes[0] && router.go(`/watch/${anime?.id}/${episodes[0].episode_number}`)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4" aria-hidden="true">
                <path d="M6.3 2.841A1.5 1.5 0 0 0 4 4.11V15.89a1.5 1.5 0 0 0 2.3 1.269l9.344-5.89a1.5 1.5 0 0 0 0-2.538L6.3 2.84Z" />
              </svg>
              Watch Episode 1
            </Button>
          {/if}

          <!-- Love / Like Anime Button -->
          <Button
            variant={likes.isLiked(anime.id) ? "default" : "outline"}
            class="gap-2 transition-all {likes.isLiked(anime.id) ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'border-rose-500/40 text-rose-500 hover:bg-rose-500/10'}"
            onclick={() =>
              anime &&
              likes.toggleLike({
                anime_id: anime.id,
                title_english: anime.title_english,
                title_romaji: anime.title_romaji,
                cover_image: anime.cover_image,
                format: anime.format,
                season_year: anime.season_year
              })}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
              <path d="m9.653 16.915-.005-.003-.019-.01a20.759 20.759 0 0 1-1.16-1.107 20.373 20.373 0 0 1-3.69-4.836A7.472 7.472 0 0 1 4 7.5C4 4.462 6.462 2 9.5 2a5.498 5.498 0 0 1 4.298 2.043A5.498 5.498 0 0 1 18.5 7.5c0 1.258-.337 2.44-.925 3.46a20.373 20.373 0 0 1-3.69 4.836 20.758 20.758 0 0 1-1.16 1.107l-.02.01-.005.003h-.002a.75.75 0 0 1-.698 0l-.002-.003Z" />
            </svg>
            {likes.isLiked(anime.id) ? "Loved Anime" : "Love this Anime"}
          </Button>
        </div>
      </div>
    </section>

    {#if watchNext}
      <section
        class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/10 p-4 shadow-sm"
        aria-label="Watch next"
      >
        <div class="min-w-0">
          <p class="text-xs font-semibold uppercase tracking-wider text-primary">Watch next</p>
          <p class="mt-0.5 truncate text-sm font-medium">
            {watchNext.title ?? title}
            — Episode {watchNext.episode_number}
            {#if watchNext.season_label}· {watchNext.season_label}{/if}
          </p>
          <p class="text-xs text-muted-foreground">{watchNext.reason}</p>
        </div>
        <Button onclick={() => router.go(`/watch/${watchNext?.anime_id}/${watchNext?.episode_number}`)}>
          {watchNext.type === "RESUME" ? "Resume" : "Watch Next"}
        </Button>
      </section>
    {/if}

    {#if franchise.length > 1}
      <section aria-label="Franchise timeline">
        <h3 class="mb-3 text-lg font-semibold tracking-tight">Franchise</h3>
        <ol class="flex gap-3 overflow-x-auto pb-2">
          {#each franchise as entry (entry.anime_id)}
            <li>
              <button
                type="button"
                class="flex w-48 flex-col gap-1 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring {entry.anime_id === anime.id
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

    <!-- Episodes Section with 16:9 Image Preview Boxes and Descriptive Titles -->
    <section aria-label="Episodes">
      <div class="mb-4 flex items-center justify-between">
        <div>
          <h3 class="text-xl font-bold tracking-tight">Episodes</h3>
          <p class="text-xs text-muted-foreground">Select an episode preview to stream</p>
        </div>
        <span class="rounded-md bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
          {episodes.length} {episodes.length === 1 ? "Episode" : "Episodes"}
        </span>
      </div>

      {#if episodes.length === 0}
        <p class="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          No episodes found for this series.
        </p>
      {:else}
        <ul class="divide-y divide-border/50 rounded-xl border border-border bg-card/40 backdrop-blur">
          {#each episodes as ep (ep.episode_id)}
            {@const previewImg = ep.thumbnail || anime.banner_image || anime.cover_image}
            <li>
              <button
                type="button"
                class="group flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onclick={() => router.go(`/watch/${anime?.id}/${ep.episode_number}`)}
              >
                <!-- 16:9 Image Preview Box with Play Hover Overlay -->
                <div class="relative h-20 w-36 sm:h-24 sm:w-44 shrink-0 overflow-hidden rounded-xl bg-muted shadow-sm ring-1 ring-border/50 transition-all duration-300 group-hover:ring-primary/60 group-hover:shadow-md">
                  {#if previewImg}
                    <img
                      src={previewImg}
                      alt=""
                      loading="lazy"
                      class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  {:else}
                    <div class="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 via-background to-muted text-muted-foreground">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-8 w-8 opacity-40">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                      </svg>
                    </div>
                  {/if}

                  <!-- Episode number stamp on preview box -->
                  <span class="absolute top-1.5 left-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-white shadow backdrop-blur">
                    EP {ep.episode_number}
                  </span>

                  {#if ep.duration_seconds}
                    <span class="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white/90 shadow backdrop-blur">
                      {Math.round(ep.duration_seconds / 60)}m
                    </span>
                  {/if}

                  <!-- Play button hover overlay with Heroicon SVG -->
                  <div class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 backdrop-blur-[1px] transition-opacity duration-200 group-hover:opacity-100">
                    <span class="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform duration-200 group-hover:scale-110">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="ml-0.5 h-5 w-5" aria-hidden="true">
                        <path d="M6.3 2.841A1.5 1.5 0 0 0 4 4.11V15.89a1.5 1.5 0 0 0 2.3 1.269l9.344-5.89a1.5 1.5 0 0 0 0-2.538L6.3 2.84Z" />
                      </svg>
                    </span>
                  </div>
                </div>

                <!-- Clean Episode Info: Title & Tag -->
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="rounded bg-primary/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                      Episode {ep.episode_number}
                    </span>
                    <span class="text-xs text-muted-foreground">Preview Available</span>
                  </div>
                  <p class="mt-1.5 truncate text-base font-semibold text-foreground transition-colors group-hover:text-primary">
                    {ep.title && ep.title !== `Episode ${ep.episode_number}` ? ep.title : `Episode ${ep.episode_number}`}
                  </p>
                  <p class="mt-0.5 text-xs text-muted-foreground">
                    Click to stream in HD anime player
                  </p>
                </div>

                <!-- Action Arrow SVG -->
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="2"
                  stroke="currentColor"
                  class="h-5 w-5 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-1 group-hover:text-primary"
                  aria-hidden="true"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  </div>
{/if}
