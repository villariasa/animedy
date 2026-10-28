<script lang="ts">
  import Hls from "hls.js";
  import type { QualityVariant, SkipSegment, SubtitleTrack } from "$lib/api/types";
  import PlayerControls from "./PlayerControls.svelte";

  let {
    streamUrl,
    subtitles = [],
    qualities = [],
    skipSegments = [],
    title = "",
    episodeLabel = "",
    canPrev = false,
    canNext = false,
    onprev,
    onnext,
    onended,
    ontoggledrawer,
    ontimeupdate,
    onpausesave,
    autoPlay = $bindable(false),
    autoNext = $bindable(false),
    autoSkipIntro = false,
    autoSkipOutro = false,
    autoFullscreen = false,
    initialSpeed = 1,
    initialVolume = 1,
    initialSubtitleLang = null,
    video = $bindable(null)
  }: {
    streamUrl: string;
    subtitles?: SubtitleTrack[];
    qualities?: QualityVariant[];
    skipSegments?: SkipSegment[];
    title?: string;
    episodeLabel?: string;
    canPrev?: boolean;
    canNext?: boolean;
    onprev?: () => void;
    onnext?: () => void;
    onended?: () => void;
    ontoggledrawer?: () => void;
    ontimeupdate?: (currentTime: number, duration: number) => void;
    onpausesave?: () => void;
    autoPlay?: boolean;
    autoNext?: boolean;
    autoSkipIntro?: boolean;
    autoSkipOutro?: boolean;
    autoFullscreen?: boolean;
    initialSpeed?: number;
    initialVolume?: number;
    initialSubtitleLang?: string | null;
    video?: HTMLVideoElement | null;
  } = $props();

  const SEEK_STEP_SECONDS = 5;
  const VOLUME_STEP = 0.1;
  const CONTROLS_HIDE_MS = 2500;

  let container = $state<HTMLDivElement | null>(null);
  let playing = $state(false);
  let autoFullscreenDone = $state(false);
  let currentTime = $state(0);
  let duration = $state(0);
  let volume = $state(1);
  let muted = $state(false);
  let speed = $state(1);
  let fullscreen = $state(false);
  let controlsVisible = $state(true);
  let activeSubtitleLang = $state<string | null>(null);
  let activeQuality = $state<string | null>(null);
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  const activeSkipSegment = $derived(
    skipSegments.find((s) => currentTime >= s.start_seconds && currentTime < s.end_seconds) ?? null
  );
  const currentSrc = $derived(
    qualities.find((q) => q.label === activeQuality)?.url ?? streamUrl
  );
  const isYouTube = $derived(
    typeof currentSrc === "string" &&
    (currentSrc.includes("youtube.com") || currentSrc.includes("youtube-nocookie.com") || currentSrc.includes("youtu.be"))
  );

  export function play(): void {
    void video?.play();
  }

  export function seekTo(seconds: number): void {
    if (video) {
      video.currentTime = Math.min(Math.max(0, seconds), duration || seconds);
    }
  }

  function togglePlay(): void {
    if (video) {
      if (video.paused) {
        void video.play();
      } else {
        video.pause();
      }
    }
  }

  function seekBy(delta: number): void {
    seekTo(currentTime + delta);
  }

  function setVolume(v: number): void {
    if (video) {
      video.volume = Math.min(1, Math.max(0, v));
      video.muted = false;
    }
  }

  function toggleMute(): void {
    if (video) {
      video.muted = !video.muted;
    }
  }

  function setSpeed(s: number): void {
    if (video) {
      video.playbackRate = s;
    }
    speed = s;
  }

  async function toggleFullscreen(): Promise<void> {
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
    } else if (container) {
      await container.requestFullscreen().catch(() => undefined);
      await lockLandscapeOrientation();
    }
  }

  async function lockLandscapeOrientation(): Promise<void> {
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (o: string) => Promise<void>;
    };
    if (typeof orientation?.lock === "function" && /Mobi|Android/i.test(navigator.userAgent)) {
      await orientation.lock("landscape").catch(() => undefined);
    }
  }

  async function togglePip(): Promise<void> {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture().catch(() => undefined);
    } else if (video && document.pictureInPictureEnabled) {
      await video.requestPictureInPicture().catch(() => undefined);
    }
  }

  function setSubtitle(lang: string | null): void {
    activeSubtitleLang = lang;
    if (video) {
      for (const track of Array.from(video.textTracks)) {
        track.mode = lang !== null && track.language === lang ? "showing" : "disabled";
      }
    }
  }

  function setQuality(label: string | null): void {
    const wasPlaying = playing;
    const at = currentTime;
    activeQuality = label;
    requestAnimationFrame(() => {
      if (video) {
        video.currentTime = at;
        video.playbackRate = speed;
        if (wasPlaying) {
          void video.play();
        }
      }
    });
  }

  function skipActiveSegment(): void {
    if (activeSkipSegment) {
      seekTo(activeSkipSegment.end_seconds);
    }
  }

  function pokeControls(): void {
    controlsVisible = true;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (playing) {
        controlsVisible = false;
      }
    }, CONTROLS_HIDE_MS);
  }

  function onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const inField = target?.tagName === "INPUT" || target?.tagName === "SELECT" || target?.tagName === "TEXTAREA";
    if (!inField) {
      const key = event.key.toLowerCase();
      let handled = true;
      if (key === " ") {
        togglePlay();
      } else if (key === "arrowleft") {
        seekBy(-SEEK_STEP_SECONDS);
      } else if (key === "arrowright") {
        seekBy(SEEK_STEP_SECONDS);
      } else if (key === "arrowup") {
        setVolume(volume + VOLUME_STEP);
      } else if (key === "arrowdown") {
        setVolume(volume - VOLUME_STEP);
      } else if (key === "f") {
        void toggleFullscreen();
      } else if (key === "m") {
        toggleMute();
      } else if (key === "n") {
        if (canNext) {
          onnext?.();
        }
      } else if (key === "s") {
        skipActiveSegment();
      } else {
        handled = false;
      }
      if (handled) {
        event.preventDefault();
        pokeControls();
      }
    }
  }

  // Auto skip intro/outro: watch currentTime against skip windows ($effect per PRD §7).
  $effect(() => {
    const seg = activeSkipSegment;
    if (seg) {
      const auto =
        (seg.skip_type === "intro" && autoSkipIntro) ||
        (seg.skip_type === "outro" && autoSkipOutro) ||
        (seg.skip_type === "recap" && autoSkipIntro);
      if (auto) {
        seekTo(seg.end_seconds);
      }
    }
  });

  let hlsInstance: Hls | null = null;

  // Stream source loader with HLS playlist support (.m3u8)
  $effect(() => {
    const src = currentSrc;
    if (!video || !src) return;

    if (src.includes(".m3u8")) {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
      } else if (Hls.isSupported()) {
        if (hlsInstance) {
          hlsInstance.destroy();
        }
        hlsInstance = new Hls({ enableWorker: true });
        hlsInstance.loadSource(src);
        hlsInstance.attachMedia(video);
      }
    } else {
      if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
      }
      video.src = src;
    }

    return () => {
      if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
      }
    };
  });

  // Apply remembered player settings once the video element exists.
  $effect(() => {
    if (video) {
      video.playbackRate = initialSpeed;
      video.volume = Math.min(1, Math.max(0, initialVolume));
      speed = initialSpeed;
      if (initialSubtitleLang !== null) {
        setSubtitle(initialSubtitleLang);
      }
    }
  });

  function onPlayEvent(): void {
    playing = true;
    pokeControls();
    if (autoFullscreen && !autoFullscreenDone && !document.fullscreenElement) {
      autoFullscreenDone = true;
      void toggleFullscreen();
    }
  }

  $effect(() => {
    const handler = () => {
      fullscreen = document.fullscreenElement !== null;
    };
    document.addEventListener("fullscreenchange", handler);
    window.addEventListener("keydown", onKeydown);
    return () => {
      document.removeEventListener("fullscreenchange", handler);
      window.removeEventListener("keydown", onKeydown);
      clearTimeout(hideTimer);
    };
  });
</script>

<div
  bind:this={container}
  role="region"
  aria-label="Video player"
  class="group relative aspect-video w-full overflow-hidden rounded-lg bg-black"
  onpointermove={pokeControls}
  onpointerdown={pokeControls}
>
  <!-- Native HTML5 Video Player with HLS Playlist and MP4 Support -->
  <!-- svelte-ignore a11y_media_has_caption -->
  <video
    bind:this={video}
    class="h-full w-full object-contain"
    playsinline
    preload="auto"
    autoplay={autoPlay}
    bind:currentTime
    bind:duration
    bind:volume
    bind:muted
    onplay={onPlayEvent}
    onpause={() => {
      playing = false;
      controlsVisible = true;
      onpausesave?.();
    }}
    ontimeupdate={() => ontimeupdate?.(currentTime, duration)}
    onended={() => onended?.()}
    onclick={togglePlay}
  >
    {#each subtitles as sub (sub.lang)}
      <track kind="subtitles" src={sub.url} srclang={sub.lang} label={sub.label} />
    {/each}
  </video>

  <!-- Big Central Play Button Overlay when paused -->
  {#if !playing && !activeSkipSegment}
    <button
      type="button"
      class="absolute inset-0 flex items-center justify-center bg-black/25 transition-opacity"
      onclick={togglePlay}
      aria-label="Play video"
    >
      <span class="flex h-16 w-16 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-2xl backdrop-blur transition-transform hover:scale-110 active:scale-95">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="ml-1 h-8 w-8" aria-hidden="true">
          <path fill-rule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clip-rule="evenodd" />
        </svg>
      </span>
    </button>
  {/if}

  {#if activeSkipSegment}
    <button
      type="button"
      class="absolute bottom-24 right-4 rounded-md bg-background/90 px-4 py-2 text-sm font-medium shadow hover:bg-background"
      onclick={skipActiveSegment}
    >
      Skip {activeSkipSegment.skip_type === "outro" ? "Outro" : activeSkipSegment.skip_type === "recap" ? "Recap" : "Intro"}
    </button>
  {/if}

  <div
    class="absolute inset-x-0 bottom-0 transition-opacity {controlsVisible
      ? 'opacity-100'
      : 'pointer-events-none opacity-0'}"
  >
    <PlayerControls
      {playing}
      {currentTime}
      {duration}
      {volume}
      {muted}
      {speed}
      {fullscreen}
      {subtitles}
      {qualities}
      {activeSubtitleLang}
      {activeQuality}
      {canPrev}
      {canNext}
      {title}
      {episodeLabel}
      bind:autoPlay
      bind:autoNext
      onplaytoggle={togglePlay}
      onseek={seekTo}
      onvolume={setVolume}
      onmutetoggle={toggleMute}
      onspeed={setSpeed}
      onsubtitle={setSubtitle}
      onquality={setQuality}
      onfullscreen={() => void toggleFullscreen()}
      onpip={() => void togglePip()}
      {onprev}
      {onnext}
      {ontoggledrawer}
    />
  </div>
</div>
