<script lang="ts">
  import { ApiError } from "$lib/api/client";
  import { buildEpisodes, getAnimeDetails, getEpisodeMedia, getFranchise, getRecommendations } from "$lib/api/anilist";
  import type { AnimeDetails, AnimeSearchResultItem, EpisodeListItem, FranchiseEntry } from "$lib/api/types";
  import { Button } from "$lib/components/ui/button";
  import { getFallbackTrailerId } from "$lib/api/jikan";
  import { getLocalProgressForAnime, type LocalProgress } from "$lib/db/local";
  import { createBackgroundPlayer, type BackgroundPlayerHandle } from "$lib/api/youtubeApi";
  import { getLocalWatchNext, type LocalWatchNext } from "$lib/continuation";
  import { displayTitle, formatAirDate, stripHtml } from "$lib/format";
  import { router } from "$lib/router.svelte";
  import { likes } from "$lib/stores/likes.svelte";
  import { watchStatusStore, WATCH_STATUS_ORDER, WATCH_STATUS_LABELS, type WatchStatus } from "$lib/stores/watchStatus.svelte";
  import { onDestroy } from "svelte";

  let { animeId }: { animeId: number } = $props();

  let anime = $state<AnimeDetails | null>(null);
  let franchise = $state<FranchiseEntry[]>([]);
  let episodes = $state<EpisodeListItem[]>([]);
  let watchNext = $state<LocalWatchNext | null>(null);
  let isDescriptionExpanded = $state(false);
  let error = $state<string | null>(null);
  let loading = $state(true);
  let recommendations = $state<AnimeSearchResultItem[]>([]);
  let progressByEpisode = $state<Map<number, LocalProgress>>(new Map());

  const CHUNK_SIZE = 50;
  let activeChunkIndex = $state(0);
  let jumpQuery = $state("");
  let viewMode = $state<"detailed" | "compact">("detailed");

  const chunks = $derived.by(() => {
    const total = episodes.length;
    if (total <= 30) return [];
    const list: Array<{ start: number; end: number; label: string }> = [];
    for (let i = 0; i < total; i += CHUNK_SIZE) {
      const start = i + 1;
      const end = Math.min(i + CHUNK_SIZE, total);
      list.push({ start, end, label: `${start} - ${end}` });
    }
    return list;
  });

  const displayedEpisodes = $derived.by(() => {
    const q = jumpQuery.trim();
    if (q) {
      const num = parseInt(q, 10);
      if (!isNaN(num)) {
        return episodes.filter((ep) => String(ep.episode_number).includes(q));
      }
      return episodes.filter((ep) => ep.title?.toLowerCase().includes(q.toLowerCase()));
    }
    if (chunks.length > 0) {
      const chunk = chunks[activeChunkIndex] ?? chunks[0];
      if (chunk) {
        return episodes.slice(chunk.start - 1, chunk.end);
      }
    }
    return episodes;
  });

  function handleJump(e?: Event): void {
    e?.preventDefault();
    const num = parseInt(jumpQuery.trim(), 10);
    if (!isNaN(num) && num >= 1 && num <= episodes.length) {
      router.go(`/watch/${anime?.id}/${num}`);
    }
  }

  const title = $derived(anime ? displayTitle(anime.title_english, anime.title_romaji) : "");
  const metaLine = $derived(
    anime
      ? [
          anime.score ? `★ ${(anime.score / 10).toFixed(1)}` : null,
          anime.popularity
            ? `${Intl.NumberFormat("en", { notation: "compact" }).format(anime.popularity)} members`
            : null,
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

  $effect(() => {
    const id = animeId;
    recommendations = [];
    if (Number.isFinite(id) && id > 0) {
      void getRecommendations(id)
        .then((items) => {
          if (animeId === id) {
            recommendations = items;
          }
        })
        .catch(() => undefined);
    }
  });

  // Per-episode watched/in-progress state, from this device's local progress.
  $effect(() => {
    const id = animeId;
    progressByEpisode = new Map();
    if (Number.isFinite(id) && id > 0) {
      void getLocalProgressForAnime(id)
        .then((rows) => {
          if (animeId === id) {
            progressByEpisode = new Map(rows.map((row) => [row.episode_number ?? 0, row]));
          }
        })
        .catch(() => undefined);
    }
  });

  async function loadAnime(id: number): Promise<void> {
    loading = true;
    error = null;
    try {
      anime = await getAnimeDetails(id);
      episodes = buildEpisodes(anime);
      void getEpisodeMedia(
        id,
        anime.mal_id,
        anime.title_english || anime.title_romaji,
        anime.start_date,
        anime.season_year,
        anime.episode_count
      ).then((media) => {
        if (media && media.size > 0) {
          if (episodes.length === 0) {
            const maxEp = Math.max(...media.keys());
            const eps: EpisodeListItem[] = [];
            for (let n = 1; n <= maxEp; n += 1) {
              const info = media.get(n);
              eps.push({
                episode_id: n,
                episode_number: n,
                title: info?.title ?? `Episode ${n}`,
                duration_seconds: anime?.episode_duration ? anime.episode_duration * 60 : null,
                air_date: info?.air_date ?? null,
                thumbnail: info?.thumbnail ?? null
              });
            }
            episodes = eps;
          } else {
            episodes = episodes.map((ep) => {
              const info = media.get(ep.episode_number);
              return {
                ...ep,
                thumbnail: info?.thumbnail ?? ep.thumbnail,
                title: info?.title ?? ep.title ?? `Episode ${ep.episode_number}`,
                air_date: info?.air_date ?? ep.air_date
              };
            });
          }
        } else {
          episodes = episodes.map((ep) => ({
            ...ep,
            title: ep.title ?? `Episode ${ep.episode_number}`
          }));
        }
      });
      franchise = await getFranchise(id).catch(() => []);
      watchNext = await getLocalWatchNext(id, anime.episode_count, franchise).catch(() => null);
    } catch (err) {
      error = err instanceof ApiError ? err.message : "Failed to load anime.";
    } finally {
      loading = false;
    }
  }

  // Banner trailer: AniList's own trailer first, falling back to Jikan/MAL
  // for entries (like Cyberpunk: Edgerunners) that AniList has none for.
  // Keyed off `anime` so it naturally tracks whichever season/entry the
  // user is currently viewing — switching seasons swaps the trailer too.
  let fallbackTrailerId = $state<string | null>(null);
  const trailerId = $derived(anime?.trailer_id ?? fallbackTrailerId);

  $effect(() => {
    const current = anime;
    fallbackTrailerId = null;
    if (current && !current.trailer_id && current.mal_id) {
      void getFallbackTrailerId(current.mal_id).then((id) => {
        if (anime?.id === current.id) {
          fallbackTrailerId = id;
        }
      });
    }
  });

  let bannerPlayerHost = $state<HTMLDivElement | undefined>(undefined);
  let bannerPlayer: BackgroundPlayerHandle | null = null;
  let bannerVideoLoaded = $state(false);

  $effect(() => {
    bannerVideoLoaded = false;
    if (!trailerId) {
      bannerPlayer?.stop();
      return;
    }
    if (bannerPlayer) {
      bannerPlayer.loadVideo(trailerId);
    } else if (bannerPlayerHost) {
      bannerPlayer = createBackgroundPlayer(bannerPlayerHost, trailerId, () => (bannerVideoLoaded = true));
    }
  });

  onDestroy(() => {
    bannerPlayer?.destroy();
  });
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
    <!-- Header Banner: trailer plays once loaded, banner image is the poster -->
    {#if anime.banner_image || trailerId}
      <div class="relative h-44 sm:h-64 lg:h-80 w-full overflow-hidden rounded-3xl shadow-xl ring-1 ring-border/40">
        {#if anime.banner_image}
          <img src={anime.banner_image} alt="" class="h-full w-full object-cover" />
        {/if}
        <div
          class="banner-video-stage absolute inset-0 {trailerId && bannerVideoLoaded ? 'opacity-100' : 'opacity-0'}"
        >
          <div bind:this={bannerPlayerHost}></div>
        </div>
        <div class="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent"></div>
      </div>
    {/if}

    <!-- Anime Detail Overview Stage with Atmospheric Blurred Backdrop -->
    <section class="relative overflow-hidden rounded-3xl border border-border/70 bg-card/50 p-5 sm:p-7 lg:p-9 shadow-2xl backdrop-blur-xl">
      <!-- Ambient blurred backdrop filling the entire details card space -->
      <div class="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        {#if anime.banner_image || anime.cover_image}
          <img
            src={anime.banner_image || anime.cover_image}
            alt=""
            class="h-full w-full object-cover blur-3xl opacity-25 scale-125"
            aria-hidden="true"
          />
        {/if}
        <div class="absolute inset-0 bg-gradient-to-b from-background/70 via-background/90 to-background"></div>
      </div>

      <div class="relative z-10 flex flex-col sm:flex-row gap-6 sm:gap-8 items-start">
        <!-- True 2:3 Aspect Ratio Anime Poster (Never squished or cropped) -->
        {#if anime.cover_image}
          <div class="relative w-48 sm:w-56 md:w-64 shrink-0 aspect-[2/3] overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10 group self-center sm:self-start">
            <img
              src={anime.cover_image}
              alt={title}
              class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            {#if anime.format}
              <span class="absolute top-2.5 left-2.5 rounded-md bg-black/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur shadow">
                {anime.format}
              </span>
            {/if}
          </div>
        {/if}

        <div class="min-w-0 flex-1">
          <h1 class="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white drop-shadow-sm">{title}</h1>
          {#if [anime.title_romaji, anime.title_native].filter((t) => t && t !== title).length > 0}
            <p class="mt-1 text-sm text-slate-300 font-medium">
              {[anime.title_romaji, anime.title_native].filter((t) => t && t !== title).join(" · ")}
            </p>
          {/if}

          <!-- Genre Details Badges -->
          {#if anime.genres && anime.genres.length > 0}
            <div class="mt-3 flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span class="inline-flex items-center gap-1 rounded-md bg-muted/90 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3 w-3 text-primary shrink-0">
                  <path fill-rule="evenodd" d="M4.5 2A2.5 2.5 0 0 0 2 4.5v3.879a2.5 2.5 0 0 0 .732 1.767l7.5 7.5a2.5 2.5 0 0 0 3.536 0l3.878-3.878a2.5 2.5 0 0 0 0-3.536l-7.5-7.5A2.5 2.5 0 0 0 8.38 2H4.5ZM5 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clip-rule="evenodd" />
                </svg>
                Genres
              </span>
              {#each anime.genres as genre}
                <span class="inline-flex items-center rounded-lg border border-primary/30 bg-primary/15 px-2.5 py-0.5 text-xs font-bold text-primary shadow-xs backdrop-blur-sm transition-all hover:bg-primary/25 hover:border-primary">
                  {genre}
                </span>
              {/each}
            </div>
          {/if}

          <p class="mt-2.5 text-sm font-medium text-slate-300">{metaLine}</p>
          {#if anime.season_label || anime.arc_name}
            <p class="mt-1 text-sm font-semibold text-foreground">
              {[anime.season_label, anime.arc_name].filter(Boolean).join(" — ")}
            </p>
          {/if}
          {#if anime.start_date}
            <p class="mt-1 text-xs text-muted-foreground">
              Aired {anime.start_date}{anime.end_date ? ` → ${anime.end_date}` : ""}
            </p>
          {/if}
        {#if anime.description}
          <div class="mt-3.5">
            <p class="max-w-prose whitespace-pre-line text-sm leading-relaxed text-foreground/90 transition-all {isDescriptionExpanded ? '' : 'line-clamp-3 sm:line-clamp-4'}">
              {stripHtml(anime.description)}
            </p>
            {#if stripHtml(anime.description).length > 180}
              <button
                type="button"
                onclick={() => (isDescriptionExpanded = !isDescriptionExpanded)}
                class="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80 transition-colors focus:outline-none"
              >
                {isDescriptionExpanded ? "Show less ▴" : "Read full synopsis ▾"}
              </button>
            {/if}
          </div>
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

          <!-- Watch Status Selector -->
          <select
            value={watchStatusStore.getStatus(anime.id) ?? ""}
            onchange={(e) => {
              const value = e.currentTarget.value as WatchStatus | "";
              if (!anime) return;
              if (value === "") {
                watchStatusStore.clearStatus(anime.id);
              } else {
                watchStatusStore.setStatus(
                  {
                    anime_id: anime.id,
                    title_english: anime.title_english,
                    title_romaji: anime.title_romaji,
                    cover_image: anime.cover_image,
                    format: anime.format,
                    season_year: anime.season_year
                  },
                  value
                );
              }
            }}
            class="h-10 rounded-xl border border-border/80 bg-card/90 px-3 text-sm font-semibold text-foreground shadow-sm backdrop-blur transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary {watchStatusStore.getStatus(anime.id) ? 'border-primary/50' : ''}"
            aria-label="Watch status"
          >
            <option value="">+ Add to List</option>
            {#each WATCH_STATUS_ORDER as status (status)}
              <option value={status}>{WATCH_STATUS_LABELS[status]}</option>
            {/each}
          </select>
        </div>
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
      <section aria-label="Franchise timeline" class="rounded-3xl border border-border/80 bg-card/70 p-4 sm:p-6 shadow-xl backdrop-blur-xl">
        <div class="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-lg sm:text-xl font-bold tracking-tight text-foreground">Franchise Timeline</h3>
              <span class="rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-bold text-primary">
                {franchise.length} {franchise.length === 1 ? 'Entry' : 'Entries'}
              </span>
            </div>
            <p class="text-xs text-muted-foreground mt-0.5">Chronological release order of all seasons, movies & spin-offs</p>
          </div>
        </div>

        <ol class="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
          {#each franchise as entry (entry.anime_id)}
            {@const isCurrent = entry.anime_id === anime.id}
            <li>
              <button
                type="button"
                class="group relative flex w-64 sm:w-72 gap-3.5 rounded-2xl border p-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring {isCurrent
                  ? 'border-primary bg-primary/20 shadow-lg shadow-primary/10 ring-2 ring-primary/60 scale-[1.01]'
                  : 'border-border/80 bg-card/90 hover:border-primary/50 hover:bg-accent/70 hover:shadow-md'}"
                onclick={() => router.go(`/anime/${entry.anime_id}`)}
              >
                <!-- Mini poster cover preview -->
                {#if entry.cover_image}
                  <div class="relative h-20 w-14 shrink-0 overflow-hidden rounded-xl bg-muted shadow-md ring-1 ring-white/10 group-hover:ring-primary/40 transition-all">
                    <img
                      src={entry.cover_image}
                      alt=""
                      class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                {/if}

                <!-- Info content -->
                <div class="min-w-0 flex-1 flex flex-col justify-between">
                  <div>
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span class="rounded-md bg-muted px-2 py-0.5 text-[10px] font-extrabold text-foreground">
                        #{entry.sequence_order ?? "?"}
                      </span>
                      {#if entry.format}
                        <span class="rounded-md bg-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                          {entry.format}
                        </span>
                      {/if}
                      {#if entry.start_date}
                        <span class="text-xs font-semibold text-foreground/80">
                          {entry.start_date.slice(0, 4)}
                        </span>
                      {/if}
                      {#if entry.status === "NOT_YET_RELEASED" || (!entry.start_date && entry.status !== "FINISHED" && entry.status !== "RELEASING")}
                        <span class="rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">UPCOMING</span>
                      {/if}
                      {#if isCurrent}
                        <span class="rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground shadow-sm">CURRENT</span>
                      {/if}
                    </div>

                    <p class="mt-1.5 line-clamp-2 text-xs sm:text-sm font-bold text-foreground transition-colors group-hover:text-primary">
                      {displayTitle(entry.title_english, entry.title_romaji)}
                    </p>
                  </div>

                  <p class="mt-1 text-xs text-muted-foreground font-medium">
                    {[entry.season_label, entry.episode_count ? `${entry.episode_count} eps` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </button>
            </li>
          {/each}
        </ol>
      </section>
    {/if}

    {#if recommendations.length > 0}
      <section aria-label="Recommendations" class="rounded-3xl border border-border/80 bg-card/70 p-4 sm:p-6 shadow-xl backdrop-blur-xl">
        <h3 class="text-lg sm:text-xl font-bold tracking-tight text-foreground mb-4">You Might Also Like</h3>
        <ul class="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
          {#each recommendations as item (item.anime_id)}
            <li class="w-32 sm:w-36 shrink-0">
              <button
                type="button"
                class="group flex w-full flex-col gap-2 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onclick={() => router.go(`/anime/${item.anime_id}`)}
              >
                <div class="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-muted shadow-sm ring-1 ring-border/40 transition-all duration-300 group-hover:shadow-md group-hover:ring-primary/60">
                  {#if item.cover_image}
                    <img
                      src={item.cover_image}
                      alt=""
                      loading="lazy"
                      class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  {/if}
                  {#if item.format}
                    <span class="absolute top-1.5 right-1.5 rounded-md bg-black/75 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-white backdrop-blur">
                      {item.format}
                    </span>
                  {/if}
                </div>
                <p class="truncate text-xs font-semibold transition-colors group-hover:text-primary">
                  {displayTitle(item.title_english, item.title_romaji)}
                </p>
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <!-- Episodes Section with 16:9 Image Preview Boxes and Descriptive Titles -->
    <section aria-label="Episodes" class="flex flex-col gap-4">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 class="text-xl font-bold tracking-tight">Episodes</h3>
          <p class="text-xs text-muted-foreground">Select an episode preview to stream</p>
        </div>

        <div class="flex items-center gap-2">
          <!-- View Switcher (Detailed List vs Fast Column Grid) -->
          <div class="inline-flex rounded-lg border border-border bg-card/60 p-0.5 text-xs">
            <button
              type="button"
              class="flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition-colors {viewMode === 'detailed' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
              onclick={() => (viewMode = 'detailed')}
              title="Detailed view with thumbnails"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-3.5 w-3.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
              List
            </button>
            <button
              type="button"
              class="flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition-colors {viewMode === 'compact' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
              onclick={() => (viewMode = 'compact')}
              title="Fast columns grid for quick selection"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-3.5 w-3.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
              </svg>
              Grid ({episodes.length})
            </button>
          </div>

          <span class="rounded-md bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            {episodes.length} {episodes.length === 1 ? "Episode" : "Episodes"}
          </span>
        </div>
      </div>

      <!-- Episode Range Chunks & Jump Bar (For 30+ episodes e.g. 200 episodes) -->
      {#if chunks.length > 0 || episodes.length > 25}
        <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/60 p-2.5 shadow-sm backdrop-blur">
          {#if chunks.length > 0}
            <div class="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <span class="text-xs font-semibold text-muted-foreground mr-1">Range:</span>
              {#each chunks as chunk, idx (chunk.label)}
                <button
                  type="button"
                  class="rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap {activeChunkIndex === idx && !jumpQuery ? 'bg-primary text-primary-foreground shadow-sm font-bold' : 'border border-border/70 text-muted-foreground hover:bg-accent hover:text-foreground'}"
                  onclick={() => { activeChunkIndex = idx; jumpQuery = ""; }}
                >
                  {chunk.label}
                </button>
              {/each}
            </div>
          {/if}

          <!-- Quick Jump Input -->
          <form onsubmit={handleJump} class="flex items-center gap-1.5 ml-auto">
            <div class="relative flex items-center">
              <input
                type="text"
                bind:value={jumpQuery}
                placeholder="Jump ep # (e.g. 190)"
                class="h-8 w-36 sm:w-44 rounded-lg border border-border/80 bg-background/80 px-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {#if jumpQuery}
                <button
                  type="button"
                  onclick={() => (jumpQuery = "")}
                  class="absolute right-2 text-muted-foreground hover:text-foreground text-xs"
                  aria-label="Clear jump query"
                >
                  ✕
                </button>
              {/if}
            </div>
            <button
              type="submit"
              class="h-8 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Go
            </button>
          </form>
        </div>
      {/if}

      {#if displayedEpisodes.length === 0}
        <p class="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          No episodes found matching your filter.
        </p>
      {:else if viewMode === "compact"}
        <!-- Quick Column Grid (For rapid 1-click selection in 10 columns) -->
        <div class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2 rounded-xl border border-border bg-card/40 p-3 backdrop-blur">
          {#each displayedEpisodes as ep (ep.episode_number)}
            {@const prog = progressByEpisode.get(ep.episode_number)}
            <button
              type="button"
              class="group relative flex flex-col items-center justify-center overflow-hidden rounded-lg border py-2.5 px-1 text-center transition-all hover:border-primary hover:bg-primary/10 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring {prog?.completed
                ? 'border-emerald-500/40 bg-emerald-500/10'
                : 'border-border/70 bg-card/80'}"
              onclick={() => router.go(`/watch/${anime?.id}/${ep.episode_number}`)}
              title={ep.title ? `Episode ${ep.episode_number}: ${ep.title}${ep.air_date ? ` (${formatAirDate(ep.air_date)})` : ''}` : `Episode ${ep.episode_number}`}
            >
              {#if prog?.completed}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="absolute top-1 right-1 h-3 w-3 text-emerald-400" aria-hidden="true">
                  <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" />
                </svg>
              {:else if prog && prog.position_seconds > 0 && prog.duration_seconds > 0}
                <div
                  class="absolute bottom-0 left-0 h-0.5 bg-primary"
                  style="width: {Math.min(100, (prog.position_seconds / prog.duration_seconds) * 100)}%"
                ></div>
              {/if}
              <span class="text-xs font-bold text-foreground group-hover:text-primary">{ep.episode_number}</span>
              <span class="text-[9px] uppercase tracking-wider text-muted-foreground/80">EP</span>
            </button>
          {/each}
        </div>
      {:else}
        <ul class="divide-y divide-border/50 rounded-xl border border-border bg-card/40 backdrop-blur">
          {#each displayedEpisodes as ep (ep.episode_id)}
            {@const previewImg = ep.thumbnail || anime.banner_image || anime.cover_image}
            {@const prog = progressByEpisode.get(ep.episode_number)}
            <li>
              <button
                type="button"
                class="group flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring {prog?.completed ? 'opacity-70' : ''}"
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
                      onerror={(e) => {
                        const target = e.currentTarget as HTMLImageElement;
                        if (anime?.cover_image && target.src !== anime.cover_image) {
                          target.src = anime.cover_image;
                        }
                      }}
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

                  {#if ep.air_date}
                    <span class="absolute bottom-1.5 left-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[9px] font-medium text-white/90 shadow backdrop-blur">
                      {formatAirDate(ep.air_date)}
                    </span>
                  {/if}

                  {#if ep.duration_seconds}
                    <span class="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white/90 shadow backdrop-blur">
                      {Math.round(ep.duration_seconds / 60)}m
                    </span>
                  {/if}

                  <!-- Watched / in-progress indicator -->
                  {#if prog?.completed}
                    <span class="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow" title="Watched">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3 w-3" aria-hidden="true">
                        <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" />
                      </svg>
                    </span>
                  {:else if prog && prog.position_seconds > 0 && prog.duration_seconds > 0}
                    <div class="absolute inset-x-0 bottom-0 h-1 bg-black/40">
                      <div
                        class="h-full bg-primary"
                        style="width: {Math.min(100, (prog.position_seconds / prog.duration_seconds) * 100)}%"
                      ></div>
                    </div>
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

                <!-- Clean Episode Info: Title, Release Date & Tag -->
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="rounded bg-primary/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                      Episode {ep.episode_number}
                    </span>
                    {#if ep.air_date}
                      <span class="inline-flex items-center gap-1 rounded bg-muted/90 px-2 py-0.5 text-[11px] font-medium text-foreground/90 ring-1 ring-border/60">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3 w-3 text-primary shrink-0" aria-hidden="true">
                          <path fill-rule="evenodd" d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75Z" clip-rule="evenodd" />
                        </svg>
                        {formatAirDate(ep.air_date)}
                      </span>
                    {/if}
                    <span class="text-xs text-muted-foreground">
                      {ep.thumbnail ? "HD Episode Preview" : "Preview Available"}
                    </span>
                  </div>
                  <p class="mt-1.5 truncate text-base font-semibold text-foreground transition-colors group-hover:text-primary">
                    {ep.title && ep.title !== `Episode ${ep.episode_number}` ? ep.title : `Episode ${ep.episode_number}`}
                  </p>
                  <p class="mt-0.5 text-xs {prog?.completed ? 'font-medium text-emerald-400' : 'text-muted-foreground'}">
                    {#if prog?.completed}
                      Watched
                    {:else if prog && prog.position_seconds > 0 && prog.duration_seconds > 0}
                      {Math.round((prog.position_seconds / prog.duration_seconds) * 100)}% watched — resume
                    {:else}
                      Click to stream in HD anime player
                    {/if}
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

<style>
  /* Scale the 16:9 YouTube iframe so it covers the banner with no
     letterboxing, regardless of the banner's own aspect ratio. */
  .banner-video-stage {
    container-type: size;
    overflow: hidden;
    pointer-events: none;
    transition: opacity 0.7s ease-out;
  }

  /* :global because this iframe is injected by the YouTube IFrame API, not
     by Svelte's template, so it never receives the scoped-style class. */
  :global(.banner-video-stage iframe) {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: max(100cqw, 177.78cqh);
    height: max(100cqh, 56.25cqw);
    border: 0;
    pointer-events: none;
  }
</style>
