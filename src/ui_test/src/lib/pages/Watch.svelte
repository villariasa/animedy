<script lang="ts">
  import { apiPost, ApiError } from "$lib/api/client";
  import { apiPostCached } from "$lib/api/cached";
  import type {
    AnimeDetailsResponse,
    EpisodeListItem,
    EpisodesListResponse,
    EpisodesSourcesResponse,
    ProgressCompleteResponse,
    ProgressGetResponse,
    SkipGetResponse,
    SkipSegment,
    WatchNextGetResponse
  } from "$lib/api/types";
  import CountdownOverlay from "$lib/components/player/CountdownOverlay.svelte";
  import Player from "$lib/components/player/Player.svelte";
  import WhatsNextOverlay from "$lib/components/player/WhatsNextOverlay.svelte";
  import { getLocalProgress, saveLocalProgress } from "$lib/db/local";
  import { displayTitle } from "$lib/format";
  import { router } from "$lib/router.svelte";
  import { auth } from "$lib/stores/auth.svelte";
  import { settings } from "$lib/stores/settings.svelte";

  let { animeId, episodeId }: { animeId: number; episodeId: number } = $props();

  let animeTitle = $state("");
  let episodes = $state<EpisodeListItem[]>([]);
  let sources = $state<EpisodesSourcesResponse | null>(null);
  let skipSegments = $state<SkipSegment[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let drawerOpen = $state(false);
  let whatsNext = $state<WatchNextGetResponse | null>(null);
  let countdownActive = $state(false);
  let resumePosition = $state(0);
  let lastPosition = $state(0);
  let lastDuration = $state(0);

  let player = $state<ReturnType<typeof Player> | undefined>();

  let autoPlay = $state(true);
  let autoNext = $state(true);

  type StreamServer = "native" | "embed_auto" | "embed_vidsrc";
  let selectedServer = $state<StreamServer>("native");

  const currentEpisode = $derived(episodes.find((e) => e.episode_id === episodeId));
  const currentEpisodeIndex = $derived(episodes.findIndex((e) => e.episode_id === episodeId));
  const episodeNum = $derived(currentEpisode?.episode_number ?? 1);
  const serverEmbedUrls = $derived<Record<"embed_auto" | "embed_vidsrc", string>>({
    embed_auto: `https://player.autoembed.cc/embed/anime/${animeId}/${episodeNum}`,
    embed_vidsrc: `https://vidsrc.cc/v2/embed/anime/${animeId}/${episodeNum}`
  });
  const prevEpisode = $derived(
    currentEpisodeIndex > 0 ? episodes[currentEpisodeIndex - 1] : undefined
  );
  const nextEpisode = $derived(
    currentEpisodeIndex >= 0 && currentEpisodeIndex < episodes.length - 1
      ? episodes[currentEpisodeIndex + 1]
      : undefined
  );

  const episodeLabel = $derived(
    currentEpisode
      ? `Episode ${currentEpisode.episode_number}${currentEpisode.title ? ` · ${currentEpisode.title}` : ""}`
      : `Episode ${episodeId}`
  );

  $effect(() => {
    const aId = animeId;
    const epId = episodeId;
    if (Number.isFinite(aId) && aId > 0 && Number.isFinite(epId) && epId > 0) {
      loadEpisode(aId, epId);
    }
  });

  // Heartbeat: save progress every 5s while watching + flush on tab close
  // and on leaving the page (PRD §7) — without this, history/continue-watching
  // only update on explicit pause or episode end.
  $effect(() => {
    const heartbeatTimer = setInterval(() => void saveProgress(), 5000);
    const flush = () => void saveProgress();
    window.addEventListener("beforeunload", flush);
    return () => {
      clearInterval(heartbeatTimer);
      window.removeEventListener("beforeunload", flush);
      void saveProgress();
    };
  });

  // Persist Auto Play / Auto Next toggle flips to settings.
  $effect(() => {
    if (
      settings.loaded &&
      (autoPlay !== settings.current.autoplay || autoNext !== settings.current.auto_next)
    ) {
      void settings.save({ autoplay: autoPlay, auto_next: autoNext });
    }
  });

  async function loadEpisode(aId: number, epId: number): Promise<void> {
    loading = true;
    error = null;
    whatsNext = null;
    countdownActive = false;
    resumePosition = 0;
    lastPosition = 0;
    lastDuration = 0;
    try {
      await settings.load();
      autoPlay = settings.current.autoplay;
      autoNext = settings.current.auto_next;
      const [detailsRes, episodesRes, sourcesRes, skipRes, progressRes, localProgress] = await Promise.all([
        apiPostCached<AnimeDetailsResponse>("/api/anime/details", { anime_id: aId }).catch(() => null),
        apiPostCached<EpisodesListResponse>("/api/episodes/list", { anime_id: aId }).catch(() => null),
        apiPostCached<EpisodesSourcesResponse>("/api/episodes/sources", { episode_id: epId }),
        apiPostCached<SkipGetResponse>("/api/skip/get", { episode_id: epId }).catch(() => null),
        auth.isLoggedIn
          ? apiPost<ProgressGetResponse>("/api/progress/get", { episode_id: epId }).catch(() => null)
          : Promise.resolve(null),
        auth.isLoggedIn ? Promise.resolve(undefined) : getLocalProgress(epId).catch(() => undefined)
      ]);
      animeTitle = detailsRes
        ? displayTitle(detailsRes.anime.title_english, detailsRes.anime.title_romaji)
        : "";
      episodes = episodesRes?.episodes ?? [];
      sources = sourcesRes;
      skipSegments = skipRes?.segments ?? [];
      if (progressRes && !progressRes.completed && progressRes.position_seconds > 0) {
        resumePosition = progressRes.position_seconds;
      } else if (localProgress && !localProgress.completed && localProgress.position_seconds > 0) {
        resumePosition = localProgress.position_seconds;
      }
    } catch (err) {
      error = err instanceof ApiError ? err.message : "Failed to load episode.";
    } finally {
      loading = false;
    }
  }

  function onPlayerTime(currentTime: number, duration: number): void {
    lastPosition = currentTime;
    lastDuration = duration;
    if (resumePosition > 0 && currentTime < 1) {
      player?.seekTo(resumePosition);
      resumePosition = 0;
    }
  }

  async function saveProgress(completed = false): Promise<void> {
    if (lastDuration > 0 && lastPosition > 0) {
      if (auth.isLoggedIn) {
        await apiPost("/api/progress/save", {
          episode_id: episodeId,
          position_seconds: Math.floor(lastPosition),
          duration_seconds: Math.floor(lastDuration)
        }).catch(() => undefined);
      } else {
        await saveLocalProgress({
          episode_id: episodeId,
          anime_id: animeId,
          position_seconds: Math.floor(lastPosition),
          duration_seconds: Math.floor(lastDuration),
          completed,
          last_watched_at: new Date().toISOString()
        }).catch(() => undefined);
      }
    }
  }

  async function onEnded(): Promise<void> {
    if (auth.isLoggedIn) {
      await apiPost<ProgressCompleteResponse>("/api/progress/complete", { episode_id: episodeId }).catch(
        () => undefined
      );
    } else {
      await saveProgress(true);
    }
    if (nextEpisode) {
      if (autoNext) {
        countdownActive = true;
      }
    } else {
      // End of this series → "What's Next?" overlay from the continuation engine.
      whatsNext = await apiPost<WatchNextGetResponse>("/api/watch-next/get", { anime_id: animeId }).catch(
        () => null
      );
    }
  }

  function onWatchNext(): void {
    const target = whatsNext;
    whatsNext = null;
    if (target?.anime && target.episode) {
      router.go(`/watch/${target.anime.anime_id}/${target.episode.episode_id}`);
    }
  }

  function goToEpisode(epId: number): void {
    drawerOpen = false;
    countdownActive = false;
    router.go(`/watch/${animeId}/${epId}`);
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
{:else if sources}
  <div class="relative flex flex-col gap-4">
    <!-- Server Switcher (Multi-Provider Option A) -->
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
          class="rounded-lg px-2.5 py-1 text-xs font-medium transition-colors {selectedServer === 'native' ? 'bg-primary text-primary-foreground shadow-sm' : 'border border-border/70 text-muted-foreground hover:bg-accent hover:text-foreground'}"
          onclick={() => (selectedServer = 'native')}
        >
          Server 1 (Native HD)
        </button>

        <button
          type="button"
          class="rounded-lg px-2.5 py-1 text-xs font-medium transition-colors {selectedServer === 'embed_auto' ? 'bg-primary text-primary-foreground shadow-sm' : 'border border-border/70 text-muted-foreground hover:bg-accent hover:text-foreground'}"
          onclick={() => (selectedServer = 'embed_auto')}
        >
          Server 2 (AutoStream)
        </button>

        <button
          type="button"
          class="rounded-lg px-2.5 py-1 text-xs font-medium transition-colors {selectedServer === 'embed_vidsrc' ? 'bg-primary text-primary-foreground shadow-sm' : 'border border-border/70 text-muted-foreground hover:bg-accent hover:text-foreground'}"
          onclick={() => (selectedServer = 'embed_vidsrc')}
        >
          Server 3 (VidSrc)
        </button>

        {#if sources.official_url}
          <a
            href={sources.official_url}
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-500 transition-colors hover:bg-amber-500/25"
            title="Open official licensed episode"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3 w-3" aria-hidden="true">
              <path fill-rule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h4a.75.75 0 0 1 0 1.5h-4Z" clip-rule="evenodd" />
              <path fill-rule="evenodd" d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0-.053 1.06Z" clip-rule="evenodd" />
            </svg>
            Official Release
          </a>
        {/if}
      </div>
    </div>

    <div class="relative">
      {#if selectedServer === "native"}
      <Player
        bind:this={player}
        streamUrl={sources.stream_url}
        subtitles={sources.subtitles}
        qualities={sources.qualities}
        {skipSegments}
        title={animeTitle}
        {episodeLabel}
        canPrev={prevEpisode !== undefined}
        canNext={nextEpisode !== undefined}
        onprev={() => prevEpisode && goToEpisode(prevEpisode.episode_id)}
        onnext={() => nextEpisode && goToEpisode(nextEpisode.episode_id)}
        ontoggledrawer={() => (drawerOpen = !drawerOpen)}
        ontimeupdate={onPlayerTime}
        onpausesave={() => void saveProgress()}
        onended={() => void onEnded()}
        autoSkipIntro={settings.current.auto_skip_intro}
        autoSkipOutro={settings.current.auto_skip_outro}
        autoFullscreen={settings.current.auto_fullscreen}
        initialSpeed={settings.current.playback_speed}
        initialVolume={settings.current.volume}
        initialSubtitleLang={settings.current.subtitle_lang || null}
        bind:autoPlay
        bind:autoNext
      />
      {:else}
        <div class="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-black shadow-lg">
          <iframe
            src={serverEmbedUrls[selectedServer]}
            title="{animeTitle} - {episodeLabel}"
            class="h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          ></iframe>
        </div>
      {/if}
      {#if whatsNext}
        <WhatsNextOverlay watchNext={whatsNext} onwatch={onWatchNext} onclose={() => (whatsNext = null)} />
      {/if}
      {#if countdownActive && nextEpisode}
        <CountdownOverlay
          label={`Up next: Episode ${nextEpisode.episode_number}${nextEpisode.title ? ` · ${nextEpisode.title}` : ""}`}
          seconds={settings.current.countdown_seconds}
          onconfirm={() => nextEpisode && goToEpisode(nextEpisode.episode_id)}
          oncancel={() => (countdownActive = false)}
        />
      {/if}
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
        {#if sources.official_url}
          <a
            href={sources.official_url}
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-500 transition-colors hover:bg-amber-500/25"
            title="Open official licensed episode"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5" aria-hidden="true">
              <path fill-rule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h4a.75.75 0 0 1 0 1.5h-4Z" clip-rule="evenodd" />
              <path fill-rule="evenodd" d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0-.053 1.06Z" clip-rule="evenodd" />
            </svg>
            Official Release ({sources.official_site || "Crunchyroll"})
          </a>
        {/if}
        <button
          type="button"
          disabled={!prevEpisode}
          class="inline-flex items-center gap-1 rounded-lg border border-border/80 px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-40 disabled:pointer-events-none"
          onclick={() => prevEpisode && goToEpisode(prevEpisode.episode_id)}
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
          onclick={() => nextEpisode && goToEpisode(nextEpisode.episode_id)}
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
          {#each episodes as ep (ep.episode_id)}
            <li>
              <button
                type="button"
                class="flex w-full items-center gap-3 rounded-lg p-2.5 text-left text-sm transition-colors hover:bg-accent {ep.episode_id ===
                episodeId
                  ? 'bg-primary/15 font-semibold text-primary ring-1 ring-primary/40'
                  : ''}"
                onclick={() => goToEpisode(ep.episode_id)}
              >
                <!-- Thumbnail Preview Box -->
                <div class="relative h-12 w-20 shrink-0 overflow-hidden rounded-md bg-muted shadow-sm">
                  {#if ep.thumbnail}
                    <img src={ep.thumbnail} alt="" class="h-full w-full object-cover" />
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
