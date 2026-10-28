<script lang="ts">
  import { apiPost, ApiError } from "$lib/api/client";
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
  import WhatsNextOverlay from "$lib/components/player/WhatsNextOverlay.svelte";
  import Player from "$lib/components/player/Player.svelte";
  import { displayTitle } from "$lib/format";
  import { router } from "$lib/router.svelte";
  import { auth } from "$lib/stores/auth.svelte";
  import { settings } from "$lib/stores/settings.svelte";

  let { animeId, episodeId }: { animeId: number; episodeId: number } = $props();

  const HEARTBEAT_MS = 5000;

  let animeTitle = $state("");
  let episodes = $state<EpisodeListItem[]>([]);
  let sources = $state<EpisodesSourcesResponse | null>(null);
  let skipSegments = $state<SkipSegment[]>([]);
  let error = $state<string | null>(null);
  let loading = $state(true);
  let drawerOpen = $state(false);
  let autoPlay = $state(settings.current.autoplay);
  let autoNext = $state(settings.current.auto_next);
  let resumePosition = $state(0);
  let countdownActive = $state(false);
  let whatsNext = $state<WatchNextGetResponse | null>(null);
  let player = $state<ReturnType<typeof Player> | null>(null);
  let lastPosition = 0;
  let lastDuration = 0;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

  const episodeIndex = $derived(episodes.findIndex((e) => e.episode_id === episodeId));
  const episode = $derived(episodeIndex >= 0 ? episodes[episodeIndex] : undefined);
  const prevEpisode = $derived(episodeIndex > 0 ? episodes[episodeIndex - 1] : undefined);
  const nextEpisode = $derived(
    episodeIndex >= 0 && episodeIndex < episodes.length - 1 ? episodes[episodeIndex + 1] : undefined
  );
  const episodeLabel = $derived(
    episode ? `Episode ${episode.episode_number}${episode.title ? ` · ${episode.title}` : ""}` : ""
  );

  $effect(() => {
    void load(animeId, episodeId);
  });

  // Heartbeat: save progress every 5s while playing + flush on unload (PRD §7).
  $effect(() => {
    heartbeatTimer = setInterval(() => void saveProgress(), HEARTBEAT_MS);
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
    if (autoPlay !== settings.current.autoplay || autoNext !== settings.current.auto_next) {
      void settings.save({ autoplay: autoPlay, auto_next: autoNext });
    }
  });

  async function load(aId: number, epId: number): Promise<void> {
    loading = true;
    error = null;
    sources = null;
    skipSegments = [];
    resumePosition = 0;
    countdownActive = false;
    try {
      await settings.load();
      autoPlay = settings.current.autoplay;
      autoNext = settings.current.auto_next;
      const [detailsRes, episodesRes, sourcesRes, skipRes, progressRes] = await Promise.all([
        apiPost<AnimeDetailsResponse>("/api/anime/details", { anime_id: aId }).catch(() => null),
        apiPost<EpisodesListResponse>("/api/episodes/list", { anime_id: aId }).catch(() => null),
        apiPost<EpisodesSourcesResponse>("/api/episodes/sources", { episode_id: epId }),
        apiPost<SkipGetResponse>("/api/skip/get", { episode_id: epId }).catch(() => null),
        auth.isLoggedIn
          ? apiPost<ProgressGetResponse>("/api/progress/get", { episode_id: epId }).catch(() => null)
          : Promise.resolve(null)
      ]);
      animeTitle = detailsRes
        ? displayTitle(detailsRes.anime.title_english, detailsRes.anime.title_romaji)
        : "";
      episodes = episodesRes?.episodes ?? [];
      sources = sourcesRes;
      skipSegments = skipRes?.segments ?? [];
      if (progressRes && !progressRes.completed && progressRes.position_seconds > 0) {
        resumePosition = progressRes.position_seconds;
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

  async function saveProgress(): Promise<void> {
    if (auth.isLoggedIn && lastDuration > 0 && lastPosition > 0) {
      await apiPost("/api/progress/save", {
        episode_id: episodeId,
        position_seconds: Math.floor(lastPosition),
        duration_seconds: Math.floor(lastDuration)
      }).catch(() => undefined);
    }
  }

  async function onEnded(): Promise<void> {
    if (auth.isLoggedIn) {
      await apiPost<ProgressCompleteResponse>("/api/progress/complete", { episode_id: episodeId }).catch(
        () => undefined
      );
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
  <p class="py-16 text-center text-sm text-muted-foreground">Loading…</p>
{:else if error}
  <p class="py-16 text-center text-sm text-destructive">{error}</p>
{:else if sources}
  <div class="relative flex flex-col gap-4">
    <div class="relative">
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

    <nav class="flex items-center justify-between text-sm" aria-label="Episode navigation">
      <a href="#/anime/{animeId}" class="text-muted-foreground hover:text-foreground">
        ← {animeTitle || "Back to anime"}
      </a>
      <span class="text-muted-foreground">{episodeLabel}</span>
    </nav>

    {#if drawerOpen}
      <aside
        class="absolute right-0 top-0 z-10 flex max-h-full w-72 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl"
        aria-label="Episode list"
      >
        <header class="flex items-center justify-between border-b border-border px-3 py-2">
          <span class="text-sm font-medium">Episodes</span>
          <button
            type="button"
            class="rounded px-2 text-muted-foreground hover:text-foreground"
            onclick={() => (drawerOpen = false)}
            aria-label="Close episode list"
          >
            ✕
          </button>
        </header>
        <ul class="divide-y divide-border overflow-y-auto">
          {#each episodes as ep (ep.episode_id)}
            <li>
              <button
                type="button"
                class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent {ep.episode_id ===
                episodeId
                  ? 'bg-primary/10 text-primary'
                  : ''}"
                onclick={() => goToEpisode(ep.episode_id)}
              >
                <span class="w-8 shrink-0 text-muted-foreground">#{ep.episode_number}</span>
                <span class="truncate">{ep.title ?? `Episode ${ep.episode_number}`}</span>
              </button>
            </li>
          {/each}
        </ul>
      </aside>
    {/if}
  </div>
{/if}
