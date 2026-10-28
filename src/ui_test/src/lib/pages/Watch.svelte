<script lang="ts">
  import { ApiError } from "$lib/api/client";
  import { buildEpisodes, getAnimeDetails } from "$lib/api/anilist";
  import type { AnimeDetails, EpisodeListItem } from "$lib/api/types";
  import { progressKey, saveLocalProgress, getLocalProgressFor } from "$lib/db/local";
  import { displayTitle } from "$lib/format";
  import { router } from "$lib/router.svelte";

  // episodeId in the route is the episode NUMBER — streams come from embed
  // providers keyed by (anilist id, episode number). No backend, no accounts.
  let { animeId, episodeId }: { animeId: number; episodeId: number } = $props();

  let anime = $state<AnimeDetails | null>(null);
  let episodes = $state<EpisodeListItem[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let drawerOpen = $state(false);

  type StreamServer = "embed_vidsrc" | "embed_multiembed" | "embed_auto";
  let selectedServer = $state<StreamServer>("embed_vidsrc");

  const animeTitle = $derived(anime ? displayTitle(anime.title_english, anime.title_romaji) : "");
  const currentEpisode = $derived(episodes.find((e) => e.episode_number === episodeId));
  const prevEpisode = $derived(episodes.find((e) => e.episode_number === episodeId - 1));
  const nextEpisode = $derived(episodes.find((e) => e.episode_number === episodeId + 1));
  const episodeLabel = $derived(
    currentEpisode
      ? `Episode ${currentEpisode.episode_number}${currentEpisode.title ? ` · ${currentEpisode.title}` : ""}`
      : `Episode ${episodeId}`
  );
  const serverEmbedUrls = $derived<Record<StreamServer, string>>({
    embed_vidsrc: `https://vidsrc.pm/embed/anime?anilist=${animeId}&ep=${episodeId}`,
    embed_multiembed: `https://multiembed.mov/?video_id=${animeId}&ep=${episodeId}`,
    embed_auto: `https://vidsrc.net/embed/anime?anilist=${animeId}&ep=${episodeId}`
  });

  $effect(() => {
    const aId = animeId;
    const epNum = episodeId;
    if (Number.isFinite(aId) && aId > 0 && Number.isFinite(epNum) && epNum > 0) {
      loadEpisode(aId, epNum);
    }
  });

  async function loadEpisode(aId: number, epNum: number): Promise<void> {
    loading = true;
    error = null;
    try {
      anime = await getAnimeDetails(aId);
      episodes = buildEpisodes(anime);
      await registerInHistory(aId, epNum);
    } catch (err) {
      error = err instanceof ApiError ? err.message : "Failed to load episode.";
    } finally {
      loading = false;
    }
  }

  // Record the watch in IndexedDB so History / Continue Watching work —
  // playback itself happens inside a cross-origin embed, so "opened the
  // episode" is the signal we track.
  async function registerInHistory(aId: number, epNum: number): Promise<void> {
    const existing = await getLocalProgressFor(aId, epNum).catch(() => undefined);
    const durationSeconds = anime?.episode_duration ? anime.episode_duration * 60 : 1440;
    await saveLocalProgress({
      episode_id: progressKey(aId, epNum),
      anime_id: aId,
      position_seconds: existing?.position_seconds ?? 0,
      duration_seconds: existing?.duration_seconds ?? durationSeconds,
      completed: existing?.completed ?? false,
      last_watched_at: new Date().toISOString(),
      title_english: anime?.title_english ?? null,
      title_romaji: anime?.title_romaji ?? null,
      episode_number: epNum,
      episode_title: currentEpisode?.title ?? `Episode ${epNum}`,
      cover_image: anime?.cover_image ?? null
    }).catch(() => undefined);
  }

  async function markWatched(): Promise<void> {
    const durationSeconds = anime?.episode_duration ? anime.episode_duration * 60 : 1440;
    await saveLocalProgress({
      episode_id: progressKey(animeId, episodeId),
      anime_id: animeId,
      position_seconds: durationSeconds,
      duration_seconds: durationSeconds,
      completed: true,
      last_watched_at: new Date().toISOString(),
      title_english: anime?.title_english ?? null,
      title_romaji: anime?.title_romaji ?? null,
      episode_number: episodeId,
      episode_title: currentEpisode?.title ?? `Episode ${episodeId}`,
      cover_image: anime?.cover_image ?? null
    }).catch(() => undefined);
    if (nextEpisode) {
      goToEpisode(nextEpisode.episode_number);
    }
  }

  function goToEpisode(epNum: number): void {
    drawerOpen = false;
    router.go(`/watch/${animeId}/${epNum}`);
  }
</script>

{#if loading}
  <div class="flex flex-col items-center justify-center py-24">
    <div class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
    <p class="mt-3 text-sm text-muted-foreground">Loading video stream…</p>
  </div>
{:else if error}
  <div class="py-16 text-center">
    <p class="text-sm font-medium text-destructive">{error}</p>
    <button
      type="button"
      class="mt-4 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow"
      onclick={() => router.go(`/anime/${animeId}`)}
    >
      Return to Anime
    </button>
  </div>
{:else if anime}
  <div class="relative flex flex-col gap-4">
    <!-- Server Switcher -->
    <div class="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-border/70 bg-card/60 px-4 py-2.5 shadow-sm backdrop-blur">
      <div class="flex items-center gap-2">
        <span class="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-primary">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5" aria-hidden="true">
            <path d="M4.464 3.162A2 2 0 0 1 6.28 2h7.44a2 2 0 0 1 1.816 1.162l1.968 4.29A2 2 0 0 1 17.5 8.442V15a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V8.442a2 2 0 0 1-.004-.99l1.968-4.29ZM14.75 9a.75.75 0 0 0-.75.75v.008a.75.75 0 0 0 .75.75h.008a.75.75 0 0 0 .75-.75V9.75a.75.75 0 0 0-.75-.75h-.008ZM12 9.75A.75.75 0 0 1 12.75 9h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75H12.75A.75.75 0 0 1 12 9.75v-.008Z" />
          </svg>
        </span>
        <span class="text-xs font-semibold text-foreground">Server:</span>
      </div>

      <div class="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          class="rounded-lg px-2.5 py-1 text-xs font-medium transition-colors {selectedServer === 'embed_vidsrc' ? 'bg-primary text-primary-foreground shadow-sm' : 'border border-border/70 text-muted-foreground hover:bg-accent hover:text-foreground'}"
          onclick={() => (selectedServer = 'embed_vidsrc')}
        >
          Server 1 (VidSrc HD)
        </button>

        <button
          type="button"
          class="rounded-lg px-2.5 py-1 text-xs font-medium transition-colors {selectedServer === 'embed_multiembed' ? 'bg-primary text-primary-foreground shadow-sm' : 'border border-border/70 text-muted-foreground hover:bg-accent hover:text-foreground'}"
          onclick={() => (selectedServer = 'embed_multiembed')}
        >
          Server 2 (MultiStream)
        </button>

        <button
          type="button"
          class="rounded-lg px-2.5 py-1 text-xs font-medium transition-colors {selectedServer === 'embed_auto' ? 'bg-primary text-primary-foreground shadow-sm' : 'border border-border/70 text-muted-foreground hover:bg-accent hover:text-foreground'}"
          onclick={() => (selectedServer = 'embed_auto')}
        >
          Server 3 (Mirror)
        </button>
      </div>
    </div>

    <div class="relative">
      <div class="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-black shadow-lg">
        <iframe
          src={serverEmbedUrls[selectedServer]}
          title="{animeTitle} - {episodeLabel}"
          class="h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        ></iframe>
      </div>
    </div>

    <!-- Navigation & Episode Selector Controls Bar -->
    <nav class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/60 p-3 shadow-sm backdrop-blur" aria-label="Episode navigation">
      <div class="flex items-center gap-3">
        <a href="#/anime/{animeId}" class="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-4 w-4" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          {animeTitle || "Back to Anime"}
        </a>
        <span class="hidden h-4 w-px bg-border sm:inline-block"></span>
        <span class="truncate text-xs font-semibold text-foreground">{episodeLabel}</span>
      </div>

      <!-- Quick Episode Switch Buttons -->
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg bg-green-500/15 px-3 py-1.5 text-xs font-semibold text-green-500 transition-colors hover:bg-green-500/25"
          onclick={() => void markWatched()}
          title="Mark this episode watched and go to the next one"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5" aria-hidden="true">
            <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" />
          </svg>
          Mark Watched{nextEpisode ? " → Next" : ""}
        </button>
        <button
          type="button"
          disabled={!prevEpisode}
          class="inline-flex items-center gap-1 rounded-lg border border-border/80 px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-40 disabled:pointer-events-none"
          onclick={() => prevEpisode && goToEpisode(prevEpisode.episode_number)}
          title="Previous Episode"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5" aria-hidden="true">
            <path d="M7.707 10.293a1 1 0 0 0 0-1.414l5-5A1 1 0 0 0 11 3H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h7a1 1 0 0 0 1.707-.707l-5-5Z" />
          </svg>
          <span class="hidden sm:inline">Prev</span>
        </button>

        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
          onclick={() => (drawerOpen = !drawerOpen)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-4 w-4" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
          Episodes ({episodes.length})
        </button>

        <button
          type="button"
          disabled={!nextEpisode}
          class="inline-flex items-center gap-1 rounded-lg border border-border/80 px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-40 disabled:pointer-events-none"
          onclick={() => nextEpisode && goToEpisode(nextEpisode.episode_number)}
          title="Next Episode"
        >
          <span class="hidden sm:inline">Next</span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5" aria-hidden="true">
            <path d="M12.293 9.707a1 1 0 0 0 0 1.414l-5 5A1 1 0 0 0 9 17h7a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H9a1 1 0 0 0-1.707.707l5 5Z" />
          </svg>
        </button>
      </div>
    </nav>

    {#if drawerOpen}
      <aside
        class="absolute right-0 top-0 z-20 flex max-h-[85vh] w-80 flex-col overflow-hidden rounded-xl border border-border bg-card/95 shadow-2xl backdrop-blur"
        aria-label="Episode list"
      >
        <header class="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <span class="text-sm font-bold">Episodes</span>
            <span class="ml-1 text-xs text-muted-foreground">({episodes.length})</span>
          </div>
          <button
            type="button"
            class="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onclick={() => (drawerOpen = false)}
            aria-label="Close episode list"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-4 w-4" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </header>
        <ul class="divide-y divide-border/50 overflow-y-auto p-1">
          {#each episodes as ep (ep.episode_number)}
            <li>
              <button
                type="button"
                class="flex w-full items-center gap-3 rounded-lg p-2.5 text-left text-sm transition-colors hover:bg-accent {ep.episode_number ===
                episodeId
                  ? 'bg-primary/15 font-semibold text-primary ring-1 ring-primary/40'
                  : ''}"
                onclick={() => goToEpisode(ep.episode_number)}
              >
                <!-- Thumbnail Preview Box -->
                <div class="relative h-12 w-20 shrink-0 overflow-hidden rounded-md bg-muted shadow-sm">
                  {#if anime.cover_image}
                    <img src={anime.cover_image} alt="" class="h-full w-full object-cover" />
                  {/if}
                  <span class="absolute top-0.5 left-0.5 rounded bg-black/80 px-1 py-0.2 text-[9px] font-bold text-white">
                    EP {ep.episode_number}
                  </span>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-xs font-medium">{ep.title ?? `Episode ${ep.episode_number}`}</p>
                  {#if ep.duration_seconds}
                    <p class="text-[10px] text-muted-foreground">{Math.round(ep.duration_seconds / 60)} min</p>
                  {/if}
                </div>
              </button>
            </li>
          {/each}
        </ul>
      </aside>
    {/if}
  </div>
{/if}
