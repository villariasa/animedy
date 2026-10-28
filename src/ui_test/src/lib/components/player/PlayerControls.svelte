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
  const btn = "rounded p-1.5 text-white/90 hover:bg-white/15 disabled:opacity-40 disabled:pointer-events-none";
  const sel = "rounded bg-black/40 px-1 py-0.5 text-xs text-white/90";
</script>

<div class="flex flex-col gap-1 bg-gradient-to-t from-black/90 to-transparent px-3 pb-2 pt-8 text-white">
  <div class="flex items-center justify-between text-xs text-white/80">
    <span class="truncate">{title}{episodeLabel ? ` — ${episodeLabel}` : ""}</span>
    <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
  </div>

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

  <div class="flex flex-wrap items-center gap-1">
    <button type="button" class={btn} onclick={onprev} disabled={!canPrev} aria-label="Previous episode">⏮</button>
    <button type="button" class={btn} onclick={onplaytoggle} aria-label={playing ? "Pause" : "Play"}>
      {playing ? "⏸" : "▶"}
    </button>
    <button type="button" class={btn} onclick={onnext} disabled={!canNext} aria-label="Next episode">⏭</button>

    <button type="button" class={btn} onclick={onmutetoggle} aria-label={muted ? "Unmute" : "Mute"}>
      {muted || volume === 0 ? "🔇" : "🔊"}
    </button>
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

    <label class="flex items-center gap-1 text-xs text-white/80">
      <input type="checkbox" bind:checked={autoPlay} class="accent-[var(--primary)]" />
      Auto Play
    </label>
    <label class="mr-2 flex items-center gap-1 text-xs text-white/80">
      <input type="checkbox" bind:checked={autoNext} class="accent-[var(--primary)]" />
      Auto Next
    </label>

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

    <button type="button" class={btn} onclick={ontoggledrawer} aria-label="Episode list">☰</button>
    <button type="button" class={btn} onclick={onpip} aria-label="Picture in picture">⧉</button>
    <button type="button" class={btn} onclick={onfullscreen} aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
      {fullscreen ? "🗗" : "⛶"}
    </button>
  </div>
</div>
