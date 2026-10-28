<script lang="ts">
  import type { QualityVariant, SubtitleTrack } from "$lib/api/types";
  import { formatTime } from "$lib/format";

  let {
    playing,
    currentTime,
    duration,
    volume,
    muted,
    speed,
    fullscreen,
    subtitles,
    qualities,
    activeSubtitleLang,
    activeQuality,
    canPrev,
    canNext,
    title,
    episodeLabel,
    autoPlay = $bindable(false),
    autoNext = $bindable(false),
    onplaytoggle,
    onseek,
    onvolume,
    onmutetoggle,
    onspeed,
    onsubtitle,
    onquality,
    onfullscreen,
    onpip,
    onprev,
    onnext,
    ontoggledrawer
  }: {
    playing: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    muted: boolean;
    speed: number;
    fullscreen: boolean;
    subtitles: SubtitleTrack[];
    qualities: QualityVariant[];
    activeSubtitleLang: string | null;
    activeQuality: string | null;
    canPrev: boolean;
    canNext: boolean;
    title: string;
    episodeLabel: string;
    autoPlay?: boolean;
    autoNext?: boolean;
    onplaytoggle?: () => void;
    onseek?: (seconds: number) => void;
    onvolume?: (v: number) => void;
    onmutetoggle?: () => void;
    onspeed?: (s: number) => void;
    onsubtitle?: (lang: string | null) => void;
    onquality?: (label: string | null) => void;
    onfullscreen?: () => void;
    onpip?: () => void;
    onprev?: () => void;
    onnext?: () => void;
    ontoggledrawer?: () => void;
  } = $props();

  const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const btn =
    "inline-flex items-center justify-center rounded-lg p-2 text-white/90 transition-colors hover:bg-white/20 hover:text-white disabled:pointer-events-none disabled:opacity-30";
  const sel =
    "rounded-lg border border-white/10 bg-black/50 px-2 py-1 text-xs font-medium text-white/90 backdrop-blur transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary";
</script>

<div class="flex flex-col gap-2 bg-gradient-to-t from-black/95 via-black/70 to-transparent px-4 pb-3 pt-10 text-white">
  <!-- Title & timestamp bar -->
  <div class="flex items-center justify-between text-xs text-white/80">
    <span class="truncate font-medium">{title}{episodeLabel ? ` — ${episodeLabel}` : ""}</span>
    <span class="font-mono tabular-nums">{formatTime(currentTime)} / {formatTime(duration)}</span>
  </div>

  <!-- Progress bar scrubber -->
  <input
    type="range"
    min="0"
    max={duration || 0}
    step="0.1"
    value={currentTime}
    oninput={(e) => onseek?.(Number(e.currentTarget.value))}
    class="h-1.5 w-full cursor-pointer accent-[var(--primary)]"
    aria-label="Seek"
  />

  <!-- Main control bar -->
  <div class="flex flex-wrap items-center gap-1.5 pt-1">
    <!-- Previous episode button with Tailwind Heroicon -->
    <button type="button" class={btn} onclick={onprev} disabled={!canPrev} aria-label="Previous episode">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.75"
        stroke="currentColor"
        class="h-4 w-4"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M21 16.811c0 .864-.933 1.406-1.683.977l-7.108-4.061a1.125 1.125 0 0 1 0-1.954l7.108-4.061A1.125 1.125 0 0 1 21 8.689v8.122ZM11.25 16.811c0 .864-.933 1.406-1.683.977l-7.108-4.061a1.125 1.125 0 0 1 0-1.954l7.108-4.061a1.125 1.125 0 0 1 1.683.977v8.122Z"
        />
      </svg>
    </button>

    <!-- Play/Pause button with Tailwind Heroicon -->
    <button type="button" class={btn} onclick={onplaytoggle} aria-label={playing ? "Pause" : "Play"}>
      {#if playing}
        <!-- Pause Heroicon -->
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5" aria-hidden="true">
          <path
            fill-rule="evenodd"
            d="M6.75 5.25a.75.75 0 0 1 .75.75v12a.75.75 0 0 1-1.5 0v-12a.75.75 0 0 1 .75-.75Zm9.75 0a.75.75 0 0 1 .75.75v12a.75.75 0 0 1-1.5 0v-12a.75.75 0 0 1 .75-.75Z"
            clip-rule="evenodd"
          />
        </svg>
      {:else}
        <!-- Play Heroicon -->
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5" aria-hidden="true">
          <path
            fill-rule="evenodd"
            d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z"
            clip-rule="evenodd"
          />
        </svg>
      {/if}
    </button>

    <!-- Next episode button with Tailwind Heroicon -->
    <button type="button" class={btn} onclick={onnext} disabled={!canNext} aria-label="Next episode">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.75"
        stroke="currentColor"
        class="h-4 w-4"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M3 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 0 1 0 1.954l-7.108 4.061A1.125 1.125 0 0 1 3 16.811V8.69ZM12.75 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 0 1 0 1.954l-7.108 4.061a1.125 1.125 0 0 1-1.683-.977V8.69Z"
        />
      </svg>
    </button>

    <!-- Mute/Volume button with Tailwind Heroicon -->
    <button type="button" class={btn} onclick={onmutetoggle} aria-label={muted ? "Unmute" : "Mute"}>
      {#if muted || volume === 0}
        <!-- Muted speaker with X -->
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.75"
          stroke="currentColor"
          class="h-4 w-4"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H9Z"
          />
        </svg>
      {:else}
        <!-- Speaker with sound wave -->
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.75"
          stroke="currentColor"
          class="h-4 w-4"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z"
          />
        </svg>
      {/if}
    </button>

    <!-- Volume slider -->
    <input
      type="range"
      min="0"
      max="1"
      step="0.05"
      value={muted ? 0 : volume}
      oninput={(e) => onvolume?.(Number(e.currentTarget.value))}
      class="h-1 w-20 cursor-pointer accent-[var(--primary)]"
      aria-label="Volume"
    />

    <span class="flex-1"></span>

    <!-- Automation toggles -->
    <label class="flex cursor-pointer items-center gap-1.5 text-xs text-white/80 hover:text-white">
      <input type="checkbox" bind:checked={autoPlay} class="rounded accent-[var(--primary)]" />
      Auto Play
    </label>
    <label class="mr-2 flex cursor-pointer items-center gap-1.5 text-xs text-white/80 hover:text-white">
      <input type="checkbox" bind:checked={autoNext} class="rounded accent-[var(--primary)]" />
      Auto Next
    </label>

    <!-- Playback speed dropdown -->
    <select
      class={sel}
      value={String(speed)}
      onchange={(e) => onspeed?.(Number(e.currentTarget.value))}
      aria-label="Playback speed"
    >
      {#each SPEEDS as s (s)}
        <option value={String(s)}>{s}×</option>
      {/each}
    </select>

    <!-- Subtitles dropdown -->
    {#if subtitles.length > 0}
      <select
        class={sel}
        value={activeSubtitleLang ?? ""}
        onchange={(e) => onsubtitle?.(e.currentTarget.value === "" ? null : e.currentTarget.value)}
        aria-label="Subtitles"
      >
        <option value="">Subs off</option>
        {#each subtitles as sub (sub.lang)}
          <option value={sub.lang}>{sub.label}</option>
        {/each}
      </select>
    {/if}

    <!-- Quality dropdown -->
    {#if qualities.length > 0}
      <select
        class={sel}
        value={activeQuality ?? ""}
        onchange={(e) => onquality?.(e.currentTarget.value === "" ? null : e.currentTarget.value)}
        aria-label="Quality"
      >
        <option value="">Auto</option>
        {#each qualities as q (q.label)}
          <option value={q.label}>{q.label}</option>
        {/each}
      </select>
    {/if}

    <!-- Episode list drawer button with Tailwind Heroicon -->
    <button type="button" class={btn} onclick={ontoggledrawer} aria-label="Episode list">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.75"
        stroke="currentColor"
        class="h-4 w-4"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M3.75 4.5h16.5m-16.5 3.75h16.5"
        />
      </svg>
    </button>

    <!-- Picture-in-picture button with Tailwind Heroicon -->
    <button type="button" class={btn} onclick={onpip} aria-label="Picture in picture">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.75"
        stroke="currentColor"
        class="h-4 w-4"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M3 5.25a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 5.25v13.5A2.25 2.25 0 0 1 18.75 21H5.25A2.25 2.25 0 0 1 3 18.75V5.25Z"
        />
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 11.25h6.75a.75.75 0 0 1 .75.75v5.25a.75.75 0 0 1-.75.75H12a.75.75 0 0 1-.75-.75V12a.75.75 0 0 1 .75-.75Z"
          fill="currentColor"
          fill-opacity="0.3"
        />
      </svg>
    </button>

    <!-- Fullscreen button with Tailwind Heroicon -->
    <button
      type="button"
      class={btn}
      onclick={onfullscreen}
      aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
    >
      {#if fullscreen}
        <!-- Exit fullscreen (arrows inward) -->
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.75"
          stroke="currentColor"
          class="h-4 w-4"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9V4.5M15 9h4.5M15 9l5.25-5.25M15 15v4.5M15 15h4.5M15 15l5.25 5.25"
          />
        </svg>
      {:else}
        <!-- Enter fullscreen (arrows outward) -->
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.75"
          stroke="currentColor"
          class="h-4 w-4"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15m11.25-11.25v4.5m0-4.5h-4.5m4.5 0L15 9m6 11.25v-4.5m0 4.5h-4.5m4.5 0L15 15"
          />
        </svg>
      {/if}
    </button>
  </div>
</div>
