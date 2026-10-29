<script lang="ts">
  import { ApiError } from "$lib/api/client";
  import { buildEpisodes, getAnimeDetails, getEpisodeMedia } from "$lib/api/anilist";
  import type { AnimeDetails, EpisodeListItem } from "$lib/api/types";
  import { getSkipSegments } from "$lib/api/aniskip";
  import { getCached, putCached } from "$lib/db/local";
  import { progressKey, saveLocalProgress, getLocalProgressFor, getLocalProgressForAnime } from "$lib/db/local";
  import { displayTitle, formatAirDate, stripHtml } from "$lib/format";
  import { router } from "$lib/router.svelte";
  import { settings } from "$lib/stores/settings.svelte";

  // episodeId in the route is the episode NUMBER — streams come from embed
  // providers keyed by (anilist id, episode number). No backend, no accounts.
  let { animeId, episodeId }: { animeId: number; episodeId: number } = $props();

  let anime = $state<AnimeDetails | null>(null);
  let episodes = $state<EpisodeListItem[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Layout & View Mode States
  let drawerViewMode = $state<"list" | "grid">("list");
  let isTheaterMode = $state(false);
  let isCinemaMode = $state(false);
  let isSynopsisExpanded = $state(false);
  let watchedEpisodeNumbers = $state<Set<number>>(new Set());

  const DRAWER_CHUNK_SIZE = 50;
  let drawerChunkIndex = $state(0);
  let drawerQuery = $state("");

  const drawerChunks = $derived.by(() => {
    const total = episodes.length;
    if (total <= 30) return [];
    const list: Array<{ start: number; end: number; label: string }> = [];
    for (let i = 0; i < total; i += DRAWER_CHUNK_SIZE) {
      const start = i + 1;
      const end = Math.min(i + DRAWER_CHUNK_SIZE, total);
      list.push({ start, end, label: `${start}-${end}` });
    }
    return list;
  });

  $effect(() => {
    const epNum = episodeId;
    if (epNum > 0 && drawerChunks.length > 0) {
      const matchingIdx = drawerChunks.findIndex((c) => epNum >= c.start && epNum <= c.end);
      if (matchingIdx >= 0) {
        drawerChunkIndex = matchingIdx;
      }
    }
  });

  const displayedDrawerEpisodes = $derived.by(() => {
    const q = drawerQuery.trim();
    if (q) {
      return episodes.filter((ep) => String(ep.episode_number).includes(q) || ep.title?.toLowerCase().includes(q.toLowerCase()));
    }
    if (drawerChunks.length > 0) {
      const chunk = drawerChunks[drawerChunkIndex] ?? drawerChunks[0];
      if (chunk) {
        return episodes.slice(chunk.start - 1, chunk.end);
      }
    }
    return episodes;
  });

  type StreamServer = "embed_animekai" | "embed_animix" | "embed_videasy" | "embed_vidsrc_cc";
  let selectedServer = $state<StreamServer>("embed_animekai");
  let frameBox = $state<HTMLDivElement | null>(null);

  // Server 2: animixplay.ba episode page, cropped so ONLY the player region is
  // visible (their player is referer-locked, so the page itself is framed).
  // Slug is derived from the title; existence is confirmed via their CORS-open
  // WordPress REST API before the server is offered.
  let animixUrl = $state<string | null>(null);
  let cropW = $state(0);
  // Measured at 1366px viewport: player box x=28 y=435 w=956 (h≈538 shown).
  const AMX = { viewport: 1366, x: 28, y: 435, w: 956 };
  const amxScale = $derived(cropW > 0 ? cropW / AMX.w : 1);

  function slugify(title: string): string {
    return title
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  async function findAnimixEpisode(epNum: number): Promise<string | null> {
    const candidates = [...new Set(
      [anime?.title_english, anime?.title_romaji]
        .filter((t): t is string => !!t)
        .map((t) => `${slugify(t)}-episode-${epNum}-english-subbed`)
    )];
    for (const slug of candidates) {
      try {
        const res = await fetch(
          `https://animixplay.ba/wp-json/wp/v2/posts?slug=${slug}&_fields=link`
        );
        if (res.ok) {
          const posts = (await res.json()) as Array<{ link: string }>;
          if (posts.length > 0) {
            return posts[0]?.link ?? `https://animixplay.ba/${slug}/`;
          }
        }
      } catch {
        // network/CORS hiccup — try next candidate
      }
    }
    return null;
  }

  const animeTitle = $derived(anime ? displayTitle(anime.title_english, anime.title_romaji) : "");
  const currentEpisode = $derived(episodes.find((e) => e.episode_number === episodeId));
  const prevEpisode = $derived(episodes.find((e) => e.episode_number === episodeId - 1));
  const nextEpisode = $derived(episodes.find((e) => e.episode_number === episodeId + 1));
  const episodeLabel = $derived(
    currentEpisode
      ? `Episode ${currentEpisode.episode_number}${currentEpisode.title ? ` · ${currentEpisode.title}` : ""}`
      : `Episode ${episodeId}`
  );
  // Server 1 is the SAME player animekai.com.ro embeds (gogoanime.me.uk wraps
  // megaplay with the right referer; keyed by MAL id + episode + sub, autostarts).
  // Verified 2026-10-28 to serve a frameable player (no X-Frame-Options).
  // Others key by AniList id. vidsrc.pm/.icu, autoembed, multiembed removed (dead).
  const malId = $derived(anime?.mal_id ?? null);
  const serverEmbedUrls = $derived<Record<StreamServer, string>>({
    // Server 1 goes through our own wrapper page whose URL contains
    // "anichi.to" — the upstream player's ad loader whitelists referrers
    // containing that string (decrypted from its own config) and injects
    // NO ad script for them. Ad-free without sandbox, so no detector fires.
    embed_animekai: `/anichi.to.html?mal=${malId ?? 0}&ep=${episodeId}&cat=sub`,
    embed_animix: animixUrl ?? "",
    embed_videasy: `https://player.videasy.net/anime/${animeId}/${episodeId}`,
    embed_vidsrc_cc: `https://vidsrc.cc/v2/embed/anime/${animeId}/${episodeId}/sub`
  });

  // User-gesture fullscreen for the frame itself ("auto" fullscreen without a
  // click is blocked by every browser).
  function fullscreenFrame(): void {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    } else {
      void frameBox?.requestFullscreen().catch(() => undefined);
    }
  }

  // ---- Server 1 player bridge (megaplay handle-bridge postMessage API) ----
  // The wrapper (anichi.to.html) relays messages both ways. We use:
  //   SKP_DATA  → sets intro/outro windows + auto-skip inside THEIR player
  //   GET_TIME  → polls real position/duration (progress + ended detection)
  //   SEEK      → resume where the user left off
  // Auto-next swaps the iframe src in place, so OUR fullscreen container
  // stays fullscreen across episodes.
  let playerFrame = $state<HTMLIFrameElement | null>(null);
  let skipIntroState = $state<[number, number] | null>(null);
  let skipOutroState = $state<[number, number] | null>(null);
  let resumePos = 0;
  let endedFired = false;
  let pollCount = 0;
  let realPos = 0;
  let realDur = 0;

  // Our OWN per-anime skip data (IndexedDB) — takes priority over AniSkip,
  // for shows AniSkip hasn't covered yet. Marked once, applies to all episodes.
  type SkipPair = [number, number];
  let customIntro = $state<SkipPair | null>(null);
  let customOutro = $state<SkipPair | null>(null);
  let markingIntro = $state<number | null>(null);
  let markingOutro = $state<number | null>(null);
  let skipSetupOpen = $state(false);

  const effectiveIntro = $derived(customIntro ?? skipIntroState);
  const effectiveOutro = $derived(customOutro ?? skipOutroState);

  function sendToPlayer(obj: Record<string, unknown>): void {
    playerFrame?.contentWindow?.postMessage(JSON.stringify(obj), "*");
  }

  function sendSkipData(): void {
    sendToPlayer({
      cmd: "SKP_DATA",
      value: { intro: effectiveIntro ?? undefined, outro: effectiveOutro ?? undefined },
      auto: settings.current.auto_skip_intro || settings.current.auto_skip_outro
    });
  }

  async function saveCustomSkip(): Promise<void> {
    await putCached(`customskip:${animeId}`, { intro: customIntro, outro: customOutro }).catch(
      () => undefined
    );
    sendSkipData();
  }

  function markIntro(): void {
    if (markingIntro === null) {
      markingIntro = Math.floor(realPos);
    } else {
      const end = Math.floor(realPos);
      if (end > markingIntro) {
        customIntro = [markingIntro, end];
        void saveCustomSkip();
      }
      markingIntro = null;
    }
  }

  function markOutro(): void {
    if (markingOutro === null) {
      markingOutro = Math.floor(realPos);
    } else {
      const end = Math.floor(realPos);
      if (end > markingOutro) {
        customOutro = [markingOutro, end];
        void saveCustomSkip();
      }
      markingOutro = null;
    }
  }

  function clearCustomSkip(): void {
    customIntro = null;
    customOutro = null;
    markingIntro = null;
    markingOutro = null;
    void saveCustomSkip();
  }

  async function saveRealProgress(pos: number, dur: number, completed: boolean): Promise<void> {
    await saveLocalProgress({
      episode_id: progressKey(animeId, episodeId),
      anime_id: animeId,
      position_seconds: Math.floor(pos),
      duration_seconds: Math.floor(dur),
      completed,
      last_watched_at: new Date().toISOString(),
      title_english: anime?.title_english ?? null,
      title_romaji: anime?.title_romaji ?? null,
      episode_number: episodeId,
      episode_title: currentEpisode?.title ?? `Episode ${episodeId}`,
      cover_image: anime?.cover_image ?? null
    }).catch(() => undefined);
  }

  async function onEpisodeEnded(pos: number, dur: number): Promise<void> {
    await saveRealProgress(pos, dur, true);
    watchedEpisodeNumbers = new Set(watchedEpisodeNumbers).add(episodeId);
    if (settings.current.auto_next && nextEpisode) {
      // Same container, new src → fullscreen (ours) survives the switch.
      goToEpisode(nextEpisode.episode_number);
    }
  }

  $effect(() => {
    void episodeId;
    const server = selectedServer;
    endedFired = false;
    pollCount = 0;
    realPos = 0;
    realDur = 0;
    if (server !== "embed_animekai") {
      return;
    }
    const onMsg = (ev: MessageEvent) => {
      let d: unknown = ev.data;
      if (typeof d === "string") {
        try {
          d = JSON.parse(d);
        } catch {
          return;
        }
      }
      if (!d || typeof d !== "object") {
        return;
      }
      const msg = d as { event?: string; time?: number; duration?: number };
      if (msg.event === "PLAYER_READY") {
        sendSkipData();
        if (resumePos > 30) {
          sendToPlayer({ cmd: "SEEK", value: resumePos });
          resumePos = 0;
        }
      } else if (msg.event === "CURRENT_TIME") {
        const time = Number(msg.time) || 0;
        const dur = Number(msg.duration) || 0;
        if (dur > 0 && time > 0) {
          realPos = time;
          realDur = dur;
          pollCount += 1;
          if (pollCount % 5 === 0) {
            void saveRealProgress(time, dur, false);
            sendSkipData();
          }
          if (!endedFired && dur > 120 && time >= dur - 2) {
            endedFired = true;
            void onEpisodeEnded(time, dur);
          }
        }
      }
    };
    window.addEventListener("message", onMsg);
    const poll = setInterval(() => {
      sendToPlayer({ cmd: "GET_TIME" });
      if (pollCount === 0) {
        sendSkipData();
      }
    }, 2000);
    return () => {
      window.removeEventListener("message", onMsg);
      clearInterval(poll);
      if (realDur > 0 && realPos > 0 && !endedFired) {
        void saveRealProgress(realPos, realDur, false);
      }
    };
  });

  $effect(() => {
    const aId = animeId;
    let epNum = episodeId;
    // Old links/history rows sometimes carry the IndexedDB storage key
    // (animeId*10000+ep) instead of the episode number — auto-correct them.
    if (epNum > 10000 && Math.floor(epNum / 10000) === aId) {
      router.go(`/watch/${aId}/${epNum % 10000}`);
    } else if (Number.isFinite(aId) && aId > 0 && Number.isFinite(epNum) && epNum > 0) {
      loadEpisode(aId, epNum);
    }
  });

  async function refreshWatched(aId: number): Promise<void> {
    const rows = await getLocalProgressForAnime(aId).catch(() => []);
    watchedEpisodeNumbers = new Set(
      rows.filter((r) => r.completed && r.episode_number).map((r) => r.episode_number as number)
    );
  }

  async function loadEpisode(aId: number, epNum: number): Promise<void> {
    loading = true;
    error = null;
    try {
      await settings.load();
      anime = await getAnimeDetails(aId);
      episodes = buildEpisodes(anime);
      void getEpisodeMedia(
        aId,
        anime.mal_id,
        anime.title_english || anime.title_romaji,
        anime.start_date,
        anime.season_year,
        anime.episode_count
      ).then((media) => {
        episodes = episodes.map((ep) => {
          const info = media.get(ep.episode_number);
          return {
            ...ep,
            thumbnail: info?.thumbnail ?? ep.thumbnail,
            title: info?.title ?? ep.title ?? `Episode ${ep.episode_number}`,
            air_date: info?.air_date ?? ep.air_date
          };
        });
      });
      animixUrl = await findAnimixEpisode(epNum);
      if (anime.mal_id === null && selectedServer === "embed_animekai") {
        selectedServer = animixUrl ? "embed_animix" : "embed_videasy";
      }
      if (selectedServer === "embed_animix" && !animixUrl) {
        selectedServer = anime.mal_id !== null ? "embed_animekai" : "embed_videasy";
      }
      // Intro/outro windows from AniSkip for the player bridge.
      skipIntroState = null;
      skipOutroState = null;
      if (anime.mal_id !== null) {
        const segs = await getSkipSegments(
          anime.mal_id,
          epNum,
          anime.episode_duration ? anime.episode_duration * 60 : 0
        ).catch(() => []);
        for (const seg of segs) {
          if (seg.skip_type === "intro") skipIntroState = [seg.start_seconds, seg.end_seconds];
          if (seg.skip_type === "outro") skipOutroState = [seg.start_seconds, seg.end_seconds];
        }
      }
      const custom = await getCached<{ intro: SkipPair | null; outro: SkipPair | null }>(
        `customskip:${aId}`
      ).catch(() => undefined);
      customIntro = custom?.intro ?? null;
      customOutro = custom?.outro ?? null;
      const existing = await getLocalProgressFor(aId, epNum).catch(() => undefined);
      resumePos = existing && !existing.completed ? existing.position_seconds : 0;
      await registerInHistory(aId, epNum);
      await refreshWatched(aId);
    } catch (err) {
      error = err instanceof ApiError ? err.message : "Failed to load episode.";
    } finally {
      loading = false;
    }
  }

  // Record the watch in IndexedDB so History / Continue Watching work
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
    watchedEpisodeNumbers = new Set(watchedEpisodeNumbers).add(episodeId);
    if (nextEpisode) {
      goToEpisode(nextEpisode.episode_number);
    }
  }

  function goToEpisode(epNum: number): void {
    router.go(`/watch/${animeId}/${epNum}`);
  }

  // Smooth scroll current episode into view in the sidebar list
  $effect(() => {
    const epNum = episodeId;
    if (!epNum) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(`watch-ep-btn-${epNum}`);
      if (el) {
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }, 150);
    return () => clearTimeout(timer);
  });

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === "Escape" && isCinemaMode) {
      isCinemaMode = false;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isCinemaMode}
  <!-- Cinema Mode / Lights Off Overlay -->
  <button
    type="button"
    class="fixed inset-0 z-40 bg-black/92 backdrop-blur-sm transition-opacity duration-300 cursor-pointer w-full h-full border-0 p-0 text-left"
    onclick={() => (isCinemaMode = false)}
    aria-label="Turn lights back on (Escape)"
  >
    <div class="absolute top-4 right-6 flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white/90 backdrop-blur transition-all hover:bg-white/20">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 text-amber-300">
        <path d="M10 2a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 2ZM10 15a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 15ZM10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM15.657 5.404a.75.75 0 1 0-1.06-1.06l-1.061 1.06a.75.75 0 0 0 1.06 1.06l1.06-1.06ZM6.464 14.596a.75.75 0 1 0-1.06-1.06l-1.06 1.06a.75.75 0 0 0 1.06 1.06l1.06-1.06ZM18 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 18 10ZM5 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 5 10ZM14.596 14.596a.75.75 0 0 0 1.06-1.06l-1.06-1.06a.75.75 0 0 0-1.06 1.06l1.06 1.06ZM5.404 5.404a.75.75 0 0 0 1.06-1.06l-1.06-1.06a.75.75 0 0 0-1.06 1.06l1.06 1.06Z" />
      </svg>
      <span>Turn on lights (Esc)</span>
    </div>
  </button>
{/if}

{#if loading}
  <div class="flex flex-col items-center justify-center py-28">
    <div class="h-10 w-10 animate-spin rounded-full border-3 border-primary border-t-transparent shadow-lg"></div>
    <p class="mt-4 text-sm font-medium text-muted-foreground animate-pulse">Loading anime stream & episodes…</p>
  </div>
{:else if error}
  <div class="mx-auto max-w-md py-20 text-center">
    <div class="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/15 text-destructive mb-3">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-6 w-6">
        <path fill-rule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clip-rule="evenodd" />
      </svg>
    </div>
    <p class="text-base font-bold text-foreground">{error}</p>
    <button
      type="button"
      class="mt-5 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-lg transition-transform active:scale-95"
      onclick={() => router.go(`/anime/${animeId}`)}
    >
      Return to Anime Page
    </button>
  </div>
{:else if anime}
  <div class="mx-auto w-full max-w-[1720px] px-3 sm:px-6 lg:px-8 py-3 sm:py-5 flex flex-col gap-4 sm:gap-6">
    <!-- Top Metadata Header Banner (Animedy Distinctive Aesthetic) -->
    <header class="relative overflow-hidden rounded-2xl border border-border/70 bg-card/60 p-4 sm:p-5 shadow-lg backdrop-blur-xl">
      <!-- Ambient subtle background glow -->
      <div class="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl"></div>

      <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <!-- Title & Badges -->
        <div class="min-w-0 flex-1">
          <h1 class="text-base sm:text-xl lg:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <span class="truncate">{animeTitle}</span>
            <span class="shrink-0 text-primary">·</span>
            <span class="shrink-0 rounded-lg border border-primary/30 bg-primary/20 px-2.5 py-0.5 text-xs sm:text-sm font-extrabold text-primary shadow-xs">
              Episode {episodeId}
            </span>
          </h1>

          {#if currentEpisode?.title && currentEpisode.title !== `Episode ${episodeId}`}
            <p class="mt-1 truncate text-xs sm:text-sm font-medium text-slate-300">
              {currentEpisode.title}
            </p>
          {/if}

          <!-- Metadata Badges Row -->
          <div class="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
            <!-- Back to Anime Details -->
            <a
              href="#/anime/{animeId}"
              class="inline-flex items-center gap-1.5 rounded-lg bg-secondary/80 px-2.5 py-1 font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Return to Anime overview"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5 text-primary">
                <path d="M4 3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H4Zm3 2h6v1H7V5Zm8 8H5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1Z" />
              </svg>
              <span class="max-w-[180px] sm:max-w-[260px] truncate">{animeTitle}</span>
            </a>

            <!-- Episode Pill -->
            <span class="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/15 px-2.5 py-0.5 text-[11px] font-bold text-primary">
              EP {episodeId}
            </span>

            <!-- Category / Audio Pill -->
            <span class="inline-flex items-center rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-emerald-400">
              SUB
            </span>

            {#if anime.format}
              <span class="inline-flex items-center rounded-lg bg-muted/80 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {anime.format}
              </span>
            {/if}

            {#if currentEpisode?.air_date}
              <span class="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3 w-3 opacity-70">
                  <path fill-rule="evenodd" d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75Z" clip-rule="evenodd" />
                </svg>
                {formatAirDate(currentEpisode.air_date)}
              </span>
            {/if}

            {#if anime.episode_duration}
              <span class="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3 w-3 opacity-70">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .2.08.39.22.53l3 3a.75.75 0 0 0 1.06-1.06l-2.78-2.78V5Z" clip-rule="evenodd" />
                </svg>
                ~{anime.episode_duration} min
              </span>
            {/if}
          </div>
        </div>

        <!-- Quick Prev / Next Jump Buttons in Banner -->
        <div class="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={!prevEpisode}
            class="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-card/80 px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:bg-accent disabled:opacity-40 disabled:pointer-events-none"
            onclick={() => prevEpisode && goToEpisode(prevEpisode.episode_number)}
            title="Previous Episode"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="h-3.5 w-3.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            <span>Prev</span>
          </button>

          <button
            type="button"
            disabled={!nextEpisode}
            class="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/15 px-3 py-1.5 text-xs font-bold text-primary transition-all hover:bg-primary/25 disabled:opacity-40 disabled:pointer-events-none"
            onclick={() => nextEpisode && goToEpisode(nextEpisode.episode_number)}
            title="Next Episode"
          >
            <span>Next</span>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="h-3.5 w-3.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </div>
    </header>

    <!-- Main Grid: Video Player (Left) + Episode Sidebar (Right) -->
    <div class="grid grid-cols-1 {isTheaterMode ? 'lg:grid-cols-1' : 'lg:grid-cols-12'} gap-5 xl:gap-6 items-start">
      <!-- LEFT: Video Player Stage + Under-Player Action Dock -->
      <div class="{isTheaterMode ? 'w-full' : 'lg:col-span-8 xl:col-span-8 2xl:col-span-9'} flex flex-col gap-3 min-w-0 {isCinemaMode ? 'relative z-50' : ''}">
        <!-- Video Player Box (Properly contained, not blown up full screen before fullscreen!) -->
        <div class="relative">
          <div
            bind:this={frameBox}
            bind:clientWidth={cropW}
            class="relative aspect-video w-full overflow-hidden rounded-2xl border border-border/80 bg-black shadow-2xl ring-1 ring-white/10 group"
          >
            {#if selectedServer === "embed_animix" && animixUrl}
              <iframe
                src={animixUrl}
                title="{animeTitle} - {episodeLabel}"
                class="border-0"
                style="width:{AMX.viewport}px;height:1200px;transform:scale({amxScale}) translate({-AMX.x}px, {-AMX.y}px);transform-origin:0 0;"
                scrolling="no"
                sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-pointer-lock"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowfullscreen
              ></iframe>
            {:else}
              <iframe
                bind:this={playerFrame}
                src={serverEmbedUrls[selectedServer]}
                title="{animeTitle} - {episodeLabel}"
                class="h-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowfullscreen
              ></iframe>
            {/if}
          </div>
        </div>

        <!-- Under-Player Controls & Server Switcher Dock -->
        <div class="flex flex-col gap-2.5 rounded-2xl border border-border/70 bg-card/70 p-3 sm:p-3.5 backdrop-blur-xl shadow-md">
          <!-- Top Dock Row: Video Servers and Viewing Utilities -->
          <div class="flex flex-wrap items-center justify-between gap-3">
            <!-- Video Servers Selector -->
            <div class="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span class="inline-flex items-center gap-1.5 text-xs font-bold text-foreground pr-1">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5 text-primary">
                  <path d="M4.464 3.162A2 2 0 0 1 6.28 2h7.44a2 2 0 0 1 1.816 1.162l1.968 4.29A2 2 0 0 1 17.5 8.442V15a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V8.442a2 2 0 0 1-.004-.99l1.968-4.29ZM14.75 9a.75.75 0 0 0-.75.75v.008a.75.75 0 0 0 .75.75h.008a.75.75 0 0 0 .75-.75V9.75a.75.75 0 0 0-.75-.75h-.008ZM12 9.75A.75.75 0 0 1 12.75 9h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75H12.75A.75.75 0 0 1 12 9.75v-.008Z" />
                </svg>
                Video Servers:
              </span>

              {#if malId !== null}
                <button
                  type="button"
                  class="rounded-lg px-2.5 py-1 text-xs font-bold transition-all {selectedServer === 'embed_animekai' ? 'bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/40' : 'border border-border/80 text-muted-foreground hover:bg-accent hover:text-foreground'}"
                  onclick={() => (selectedServer = 'embed_animekai')}
                >
                  Server 1
                </button>
              {/if}

              {#if animixUrl}
                <button
                  type="button"
                  class="rounded-lg px-2.5 py-1 text-xs font-bold transition-all {selectedServer === 'embed_animix' ? 'bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/40' : 'border border-border/80 text-muted-foreground hover:bg-accent hover:text-foreground'}"
                  onclick={() => (selectedServer = 'embed_animix')}
                >
                  Server 2
                </button>
              {/if}

              <button
                type="button"
                class="rounded-lg px-2.5 py-1 text-xs font-bold transition-all {selectedServer === 'embed_videasy' ? 'bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/40' : 'border border-border/80 text-muted-foreground hover:bg-accent hover:text-foreground'}"
                onclick={() => (selectedServer = 'embed_videasy')}
              >
                Server 3
              </button>

              <button
                type="button"
                class="rounded-lg px-2.5 py-1 text-xs font-bold transition-all {selectedServer === 'embed_vidsrc_cc' ? 'bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/40' : 'border border-border/80 text-muted-foreground hover:bg-accent hover:text-foreground'}"
                onclick={() => (selectedServer = 'embed_vidsrc_cc')}
              >
                Server 4
              </button>
            </div>

            <!-- View Modes & Player Actions -->
            <div class="flex flex-wrap items-center gap-1.5">
              <!-- Expand / Theater Mode -->
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all {isTheaterMode ? 'border border-primary/40 bg-primary/20 text-primary' : 'border border-border/80 text-muted-foreground hover:bg-accent hover:text-foreground'}"
                onclick={() => (isTheaterMode = !isTheaterMode)}
                title={isTheaterMode ? "Return to normal view" : "Expand player (Theater mode)"}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-3.5 w-3.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                </svg>
                <span>{isTheaterMode ? "Standard" : "Expand"}</span>
              </button>

              <!-- Turn Off Light (Cinema Mode) -->
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all {isCinemaMode ? 'border border-amber-400/40 bg-amber-400/20 text-amber-300' : 'border border-border/80 text-muted-foreground hover:bg-accent hover:text-foreground'}"
                onclick={() => (isCinemaMode = !isCinemaMode)}
                title="Dim ambient lights for cinema experience"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5 text-amber-400">
                  <path d="M10 2a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 2ZM10 15a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 15ZM10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM15.657 5.404a.75.75 0 1 0-1.06-1.06l-1.061 1.06a.75.75 0 0 0 1.06 1.06l1.06-1.06ZM6.464 14.596a.75.75 0 1 0-1.06-1.06l-1.06 1.06a.75.75 0 0 0 1.06 1.06l1.06-1.06ZM18 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 18 10ZM5 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 5 10ZM14.596 14.596a.75.75 0 0 0 1.06-1.06l-1.06-1.06a.75.75 0 0 0-1.06 1.06l1.06 1.06ZM5.404 5.404a.75.75 0 0 0 1.06-1.06l-1.06-1.06a.75.75 0 0 0-1.06 1.06l1.06 1.06Z" />
                </svg>
                <span>Light</span>
              </button>

              <!-- Fullscreen Button -->
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-lg border border-border/80 px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
                onclick={fullscreenFrame}
                title="Fullscreen the player frame"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-3.5 w-3.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                </svg>
                <span>Fullscreen</span>
              </button>

              {#if selectedServer === "embed_animekai"}
                <button
                  type="button"
                  class="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all {skipSetupOpen ? 'bg-primary text-primary-foreground shadow-sm' : 'border border-border/80 text-muted-foreground hover:bg-accent hover:text-foreground'}"
                  onclick={() => (skipSetupOpen = !skipSetupOpen)}
                  title="Configure skip intro/outro markers for this anime"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-3.5 w-3.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 0 1 0 1.954l-7.108 4.061A1.125 1.125 0 0 1 3 16.811V8.69ZM12.75 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 0 1 0 1.954l-7.108 4.061a1.125 1.125 0 0 1-1.683-.977V8.69Z" />
                  </svg>
                  <span>Skip Setup</span>
                </button>
              {/if}
            </div>
          </div>

          <!-- Bottom Dock Row: Mark Watched, Download & Help -->
          <div class="flex flex-wrap items-center justify-between gap-2.5 border-t border-border/50 pt-2 text-xs">
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 font-bold text-emerald-400 transition-all hover:bg-emerald-500/25 active:scale-95"
                onclick={() => void markWatched()}
                title="Mark this episode watched and proceed to next"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5">
                  <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" />
                </svg>
                <span>Mark Watched{nextEpisode ? " → Next" : ""}</span>
              </button>

              <a
                href={serverEmbedUrls[selectedServer]}
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/15 px-3 py-1 font-bold text-sky-400 transition-all hover:bg-sky-500/25"
                title="Open player full-page in a new tab"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-3.5 w-3.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                <span>Download</span>
              </a>
            </div>

            <p class="text-[11px] text-muted-foreground">
              Not loading? Switch servers above or whitelist this site in your ad blocker.
            </p>
          </div>
        </div>

        <!-- Skip Setup Panel -->
        {#if skipSetupOpen && selectedServer === "embed_animekai"}
          <div class="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-card/60 p-3.5 text-xs shadow-sm backdrop-blur">
            <span class="font-bold text-foreground">Your skip data (applies to whole series):</span>
            <button
              type="button"
              class="rounded-lg px-2.5 py-1 font-semibold transition-colors {markingIntro !== null ? 'animate-pulse bg-amber-400 text-amber-950 font-bold' : 'border border-border/70 hover:bg-accent'}"
              onclick={markIntro}
              title="Click at the start of the opening theme, then again at its end"
            >
              {markingIntro !== null ? `Intro start ${markingIntro}s — click at END` : customIntro ? `Intro ${customIntro[0]}s–${customIntro[1]}s ↻` : "Mark Intro"}
            </button>
            <button
              type="button"
              class="rounded-lg px-2.5 py-1 font-semibold transition-colors {markingOutro !== null ? 'animate-pulse bg-amber-400 text-amber-950 font-bold' : 'border border-border/70 hover:bg-accent'}"
              onclick={markOutro}
              title="Click at the start of the ending theme, then again at its end"
            >
              {markingOutro !== null ? `Outro start ${markingOutro}s — click at END` : customOutro ? `Outro ${customOutro[0]}s–${customOutro[1]}s ↻` : "Mark Outro"}
            </button>
            {#if customIntro || customOutro}
              <button
                type="button"
                class="rounded-lg border border-red-500/40 px-2.5 py-1 font-medium text-red-400 hover:bg-red-500/10"
                onclick={clearCustomSkip}
              >
                Clear
              </button>
            {/if}
            <span class="ml-auto text-[11px] text-muted-foreground">
              Play video, click at start of OP/ED, click again at end — auto-skip will handle the rest!
            </span>
          </div>
        {/if}
      </div>

      <!-- RIGHT: Episodes List Sidebar (Directly beside player on desktop) -->
      <aside
        class="{isTheaterMode ? 'w-full' : 'lg:col-span-4 xl:col-span-4 2xl:col-span-3'} flex flex-col"
        aria-label="Episodes list"
      >
        <div class="flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card/75 shadow-xl backdrop-blur-xl h-[560px] lg:h-[620px] transition-all">
          <!-- Sidebar Header -->
          <div class="flex items-center justify-between border-b border-border/70 bg-muted/20 px-4 py-3">
            <div class="flex items-center gap-2">
              <span class="text-sm font-black tracking-wide text-foreground">Episodes list</span>
              <span class="rounded-full bg-primary/20 px-2 py-0.5 text-[11px] font-bold text-primary">
                {episodes.length}
              </span>
            </div>

            <!-- List vs Grid View Toggle Buttons -->
            <div class="inline-flex rounded-lg border border-border/80 bg-background/80 p-0.5 text-xs shadow-xs">
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-bold transition-all {drawerViewMode === 'list' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
                onclick={() => (drawerViewMode = 'list')}
                title="Detailed list with thumbnails"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5">
                  <path fill-rule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75Zm0 5A.75.75 0 0 1 2.75 9h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 9.75Zm0 5a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z" clip-rule="evenodd" />
                </svg>
                <span>List</span>
              </button>

              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-bold transition-all {drawerViewMode === 'grid' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
                onclick={() => (drawerViewMode = 'grid')}
                title="Compact numbered grid"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5">
                  <path fill-rule="evenodd" d="M4.25 2A2.25 2.25 0 0 0 2 4.25v2.5A2.25 2.25 0 0 0 4.25 9h2.5A2.25 2.25 0 0 0 9 6.75v-2.5A2.25 2.25 0 0 0 6.75 2h-2.5Zm0 9A2.25 2.25 0 0 0 2 13.25v2.5A2.25 2.25 0 0 0 4.25 18h2.5A2.25 2.25 0 0 0 9 15.75v-2.5A2.25 2.25 0 0 0 6.75 11h-2.5Zm9-9A2.25 2.25 0 0 0 11 4.25v2.5A2.25 2.25 0 0 0 13.25 9h2.5A2.25 2.25 0 0 0 18 6.75v-2.5A2.25 2.25 0 0 0 15.75 2h-2.5Zm0 9A2.25 2.25 0 0 0 11 13.25v2.5A2.25 2.25 0 0 0 13.25 18h2.5A2.25 2.25 0 0 0 18 15.75v-2.5A2.25 2.25 0 0 0 15.75 11h-2.5Z" clip-rule="evenodd" />
                </svg>
                <span>Grid</span>
              </button>
            </div>
          </div>

          <!-- Quick Jump & Episode Range Sub-bar -->
          <div class="flex flex-col gap-2 border-b border-border/60 bg-background/40 p-2.5">
            <!-- Search Input -->
            <div class="relative flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground">
                <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clip-rule="evenodd" />
              </svg>
              <input
                type="text"
                bind:value={drawerQuery}
                placeholder="Find episode (e.g. 5 or title)..."
                class="h-8 w-full rounded-xl border border-border/80 bg-muted/40 pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-primary focus:bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {#if drawerQuery}
                <button
                  type="button"
                  onclick={() => (drawerQuery = "")}
                  class="absolute right-2 text-xs text-muted-foreground hover:text-foreground"
                  aria-label="Clear filter"
                >
                  ✕
                </button>
              {/if}
            </div>

            <!-- Range Chunks Pills (for 30+ episodes) -->
            {#if drawerChunks.length > 0}
              <div class="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-thin">
                {#each drawerChunks as chunk, idx (chunk.label)}
                  <button
                    type="button"
                    class="rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all whitespace-nowrap {drawerChunkIndex === idx && !drawerQuery ? 'bg-primary text-primary-foreground font-black shadow-xs' : 'border border-border/70 text-muted-foreground hover:bg-accent hover:text-foreground'}"
                    onclick={() => { drawerChunkIndex = idx; drawerQuery = ""; }}
                  >
                    {chunk.label}
                  </button>
                {/each}
              </div>
            {/if}
          </div>

          <!-- Scrollable Episodes Shelf -->
          <div class="flex-1 overflow-y-auto p-2 scrollbar-thin">
            {#if drawerViewMode === "list"}
              <!-- List View (like AnimeKai, rich cards with thumbnails) -->
              <ul class="flex flex-col gap-1.5">
                {#each displayedDrawerEpisodes as ep (ep.episode_number)}
                  <li>
                    <button
                      id={`watch-ep-btn-${ep.episode_number}`}
                      type="button"
                      class="group relative flex w-full items-center gap-3 rounded-xl p-2 text-left transition-all {ep.episode_number === episodeId ? 'border border-primary/50 bg-primary/20 text-primary shadow-sm' : 'border border-transparent hover:border-border/60 hover:bg-accent/70 text-foreground'}"
                      onclick={() => goToEpisode(ep.episode_number)}
                    >
                      <!-- Thumbnail Container -->
                      <div class="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-muted shadow-xs">
                        {#if ep.thumbnail || anime.banner_image || anime.cover_image}
                          <img
                            src={ep.thumbnail || anime.banner_image || anime.cover_image}
                            alt=""
                            class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                          />
                        {/if}

                        {#if ep.episode_number === episodeId}
                          <!-- Glowing Playing indicator -->
                          <div class="absolute inset-0 flex items-center justify-center bg-primary/40 backdrop-blur-2xs">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-5 w-5 text-white animate-pulse">
                              <path d="M6.3 2.841A1.5 1.5 0 0 0 4 4.11V15.89a1.5 1.5 0 0 0 2.3 1.269l9.344-5.89a1.5 1.5 0 0 0 0-2.538L6.3 2.84Z" />
                            </svg>
                          </div>
                        {:else}
                          <div class="absolute inset-0 bg-black/25 group-hover:bg-black/10 transition-colors"></div>
                          <span class="absolute top-1 left-1 rounded bg-black/80 px-1 py-0.2 text-[9px] font-bold text-white">
                            EP {ep.episode_number}
                          </span>
                        {/if}
                      </div>

                      <!-- Episode Text & Status -->
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center justify-between gap-1">
                          <p class="truncate text-xs font-bold {ep.episode_number === episodeId ? 'text-primary' : 'text-foreground'}">
                            Episode {ep.episode_number}
                          </p>
                          {#if watchedEpisodeNumbers.has(ep.episode_number)}
                            <span class="text-emerald-400 shrink-0" title="Completed">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5">
                                <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" />
                              </svg>
                            </span>
                          {/if}
                        </div>

                        <p class="truncate text-[11px] text-muted-foreground mt-0.5">
                          {ep.title && ep.title !== `Episode ${ep.episode_number}` ? ep.title : animeTitle}
                        </p>

                        <div class="flex items-center gap-2 text-[10px] text-muted-foreground/80 mt-1">
                          {#if ep.air_date}
                            <span>{formatAirDate(ep.air_date)}</span>
                          {/if}
                          {#if ep.episode_number === episodeId}
                            <span class="rounded bg-primary/20 px-1.5 py-0.2 text-[9px] font-black text-primary uppercase tracking-wider">
                              Playing
                            </span>
                          {/if}
                        </div>
                      </div>
                    </button>
                  </li>
                {/each}
              </ul>
            {:else}
              <!-- Grid View: Rapid compact tiles -->
              <div class="grid grid-cols-4 sm:grid-cols-5 gap-1.5 p-1">
                {#each displayedDrawerEpisodes as ep (ep.episode_number)}
                  <button
                    id={`watch-ep-btn-${ep.episode_number}`}
                    type="button"
                    class="group relative flex flex-col items-center justify-center rounded-xl p-2 text-center transition-all {ep.episode_number === episodeId ? 'border border-primary bg-primary text-primary-foreground font-black shadow-md ring-2 ring-primary/40' : 'border border-border/70 bg-card/80 hover:border-primary hover:bg-primary/10 hover:text-primary'}"
                    onclick={() => goToEpisode(ep.episode_number)}
                    title={ep.title ? `Episode ${ep.episode_number}: ${ep.title}` : `Episode ${ep.episode_number}`}
                  >
                    <span class="text-xs font-bold leading-none">{ep.episode_number}</span>
                    <span class="text-[8px] uppercase tracking-wider opacity-70 mt-0.5">EP</span>
                    {#if watchedEpisodeNumbers.has(ep.episode_number) && ep.episode_number !== episodeId}
                      <span class="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                    {/if}
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </aside>
    </div>

    <!-- Quick Anime Overview Card Below Player & Sidebar -->
    <section class="relative overflow-hidden rounded-2xl border border-border/70 bg-card/60 p-4 sm:p-6 backdrop-blur-xl shadow-lg">
      <div class="flex flex-col sm:flex-row gap-5 items-start">
        {#if anime.cover_image}
          <div class="relative w-28 sm:w-36 md:w-44 shrink-0 aspect-[2/3] overflow-hidden rounded-xl shadow-xl ring-1 ring-white/10 group self-center sm:self-start">
            <img
              src={anime.cover_image}
              alt={animeTitle}
              class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            {#if anime.format}
              <span class="absolute top-2 left-2 rounded-md bg-black/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur">
                {anime.format}
              </span>
            {/if}
          </div>
        {/if}

        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 class="text-lg sm:text-xl font-black text-foreground">
                <a href="#/anime/{animeId}" class="hover:text-primary transition-colors">
                  {animeTitle}
                </a>
              </h2>
              {#if anime.title_romaji && anime.title_romaji !== animeTitle}
                <p class="text-xs text-muted-foreground mt-0.5">{anime.title_romaji}</p>
              {/if}
            </div>

            <a
              href="#/anime/{animeId}"
              class="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3.5 py-1.5 text-xs font-bold text-primary transition-all hover:bg-primary/20 hover:border-primary active:scale-95"
            >
              <span>View Full Anime Details</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="h-3.5 w-3.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </a>
          </div>

          <!-- Genres Badges -->
          {#if anime.genres && anime.genres.length > 0}
            <div class="mt-2.5 flex flex-wrap items-center gap-1.5">
              {#each anime.genres as genre}
                <span class="inline-flex items-center rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                  {genre}
                </span>
              {/each}
            </div>
          {/if}

          <!-- Synopsis with Expand Toggle -->
          {#if anime.description}
            <div class="mt-3">
              <p class="text-xs sm:text-sm leading-relaxed text-foreground/80 transition-all {isSynopsisExpanded ? '' : 'line-clamp-2 sm:line-clamp-3'}">
                {stripHtml(anime.description)}
              </p>
              {#if stripHtml(anime.description).length > 160}
                <button
                  type="button"
                  onclick={() => (isSynopsisExpanded = !isSynopsisExpanded)}
                  class="mt-1 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                >
                  {isSynopsisExpanded ? "Show less ▴" : "Read more ▾"}
                </button>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    </section>
  </div>
{/if}

