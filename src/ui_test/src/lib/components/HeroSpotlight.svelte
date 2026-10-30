<script lang="ts">
  import type { AnimeSearchResultItem } from "$lib/api/types";
  import { getHDBanner } from "$lib/api/kitsu";
  import { getFallbackTrailerId } from "$lib/api/jikan";
  import { createBackgroundPlayer, type BackgroundPlayerHandle } from "$lib/api/youtubeApi";
  import { displayTitle } from "$lib/format";
  import { router } from "$lib/router.svelte";
  import { likes } from "$lib/stores/likes.svelte";
  import { ambience } from "$lib/stores/ambience.svelte";
  import { onDestroy } from "svelte";

  let { items = [] }: { items: AnimeSearchResultItem[] } = $props();

  // Strictly filter to items that have verified ultra-HD panoramic banner images
  const validItems = $derived.by(() => {
    const withBanners = items.filter((i) => Boolean(i.banner_image));
    return withBanners.length > 0 ? withBanners : items;
  });

  let currentIndex = $state(0);
  let isPaused = $state(false);
  // Ultra-HD banner upgrades from Kitsu (anime_id → image url).
  let hdBanners = $state<Record<number, string>>({});
  const requestedBanners = new Set<number>();

  $effect(() => {
    for (const item of validItems.slice(0, 8)) {
      const id = item.anime_id;
      if (!requestedBanners.has(id)) {
        requestedBanners.add(id);
        void getHDBanner(id).then((url) => {
          if (url) {
            hdBanners = { ...hdBanners, [id]: url };
          }
        });
      }
    }
  });

  const currentItem = $derived(validItems[currentIndex] ?? null);

  // Trailers fetched from Jikan/MAL for items AniList has none for.
  let fallbackTrailers = $state<Record<number, string | null>>({});
  const requestedTrailers = new Set<number>();

  $effect(() => {
    for (const item of validItems.slice(0, 8)) {
      const id = item.anime_id;
      if (!item.trailer_id && item.mal_id && !requestedTrailers.has(id)) {
        requestedTrailers.add(id);
        void getFallbackTrailerId(item.mal_id).then((trailerId) => {
          fallbackTrailers = { ...fallbackTrailers, [id]: trailerId };
        });
      }
    }
  });

  // Muted YouTube trailer for the active slide (autoplay requires mute).
  const trailerId = $derived(
    currentItem ? currentItem.trailer_id ?? fallbackTrailers[currentItem.anime_id] ?? null : null
  );
  let videoLoaded = $state(false);

  // Drives playback ourselves via the YT IFrame API (instead of autoplay/loop
  // URL params) so YouTube never flashes its native play/pause control icon.
  let playerHost = $state<HTMLDivElement | undefined>(undefined);
  let player: BackgroundPlayerHandle | null = null;

  $effect(() => {
    videoLoaded = false;
    if (!trailerId) {
      player?.stop();
      return;
    }
    if (player) {
      player.loadVideo(trailerId);
    } else if (playerHost) {
      player = createBackgroundPlayer(playerHost, trailerId, () => (videoLoaded = true));
    }
  });

  onDestroy(() => {
    player?.destroy();
  });

  // Candidate art per item, best-quality first; images that 404 get skipped.
  let failedImages = $state<Record<string, boolean>>({});

  function heroCandidates(item: AnimeSearchResultItem): string[] {
    return [hdBanners[item.anime_id], item.trailer_thumbnail, item.banner_image, item.cover_image]
      .filter((u): u is string => Boolean(u))
      .filter((u) => !failedImages[u]);
  }

  // Each slide claims a DIFFERENT image: earlier slides reserve their art, so
  // seasons sharing a franchise banner fall through to their own trailer art.
  const heroImageByIndex = $derived.by(() => {
    const used: Record<string, boolean> = {};
    return validItems.map((item) => {
      const candidates = heroCandidates(item);
      const pick = candidates.find((u) => !used[u]) ?? candidates[0] ?? null;
      if (pick) {
        used[pick] = true;
      }
      return pick;
    });
  });

  const heroImage = $derived(heroImageByIndex[currentIndex] ?? null);

  // Drive the full-page ambient background from the active slide; clear it
  // when the carousel unmounts (other pages / active search).
  $effect(() => {
    ambience.image = heroImage;
    return () => {
      ambience.image = null;
    };
  });

  function onHeroError(): void {
    if (heroImage) {
      failedImages = { ...failedImages, [heroImage]: true };
    }
  }

  function stripHtml(html: string | null | undefined): string {
    if (!html) return "";
    return html
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/&#039;/g, "'")
      .trim();
  }

  function nextSlide(): void {
    if (validItems.length === 0) return;
    currentIndex = (currentIndex + 1) % validItems.length;
  }

  function prevSlide(): void {
    if (validItems.length === 0) return;
    currentIndex = (currentIndex - 1 + validItems.length) % validItems.length;
  }

  function goToSlide(index: number): void {
    currentIndex = index;
  }

  // Auto-advance: give trailer slides longer screen time than static banners.
  $effect(() => {
    if (validItems.length <= 1 || isPaused) return;
    void currentIndex;
    const duration = trailerId ? 15000 : 6000;
    const timer = setTimeout(nextSlide, duration);

    return () => {
      clearTimeout(timer);
    };
  });
</script>

{#if currentItem}
  <section
    class="relative w-full overflow-hidden rounded-3xl border border-border/70 bg-card/60 shadow-2xl"
    aria-label="Spotlight Carousel"
    onmouseenter={() => (isPaused = true)}
    onmouseleave={() => (isPaused = false)}
  >
    <!-- Background Hero Visual with Cinematic Fade Overlays -->
    <div class="absolute inset-0 z-0 overflow-hidden">
      {#if heroImage}
        <img
          onerror={onHeroError}
          src={heroImage}
          alt={displayTitle(currentItem.title_english, currentItem.title_romaji)}
          class="h-full w-full object-cover object-center transition-opacity duration-700 ease-out"
          loading="eager"
          decoding="async"
        />
      {:else if currentItem.cover_image}
        <div class="absolute inset-0 bg-background/90"></div>
        <img
          src={currentItem.cover_image}
          alt=""
          class="h-full w-full object-cover blur-3xl opacity-20"
        />
      {/if}

      <!-- Trailer video takes over the stage once it has loaded -->
      <div
        class="hero-video-stage absolute inset-0 {trailerId && videoLoaded ? 'opacity-100' : 'opacity-0'}"
      >
        <div bind:this={playerHost}></div>
      </div>

      <!-- Multi-directional cinematic vignette gradients -->
      <div class="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent lg:hidden"></div>
      <div class="absolute inset-0 hidden lg:block bg-gradient-to-r from-background via-background/90 to-transparent w-3/4"></div>
      <div class="absolute inset-0 bg-gradient-to-t from-background via-transparent to-black/40"></div>
    </div>

    <!-- Foreground Dual-Pane Layout -->
    <div class="relative z-10 flex flex-col lg:flex-row items-stretch justify-between p-6 sm:p-8 lg:p-10 gap-8 min-h-[440px] lg:min-h-[500px]">
      <!-- Left Hero Showcase -->
      <div class="flex flex-col justify-end lg:justify-center max-w-2xl min-w-0">
        <!-- Spotlight Tag & Quality Badges -->
        <div class="flex flex-wrap items-center gap-2 mb-3">
          <span class="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary border border-primary/30 backdrop-blur-md">
            <span class="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></span>
            #Spotlight {currentIndex + 1}
          </span>

          {#if currentItem.format}
            <span class="rounded-md bg-white/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-white backdrop-blur">
              {currentItem.format}
            </span>
          {/if}

          {#if currentItem.score}
            <span class="inline-flex items-center gap-1 rounded-md bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-300 border border-amber-500/30">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3 w-3 text-amber-400">
                <path fill-rule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z" clip-rule="evenodd" />
              </svg>
              {(currentItem.score / 10).toFixed(1)}
            </span>
          {/if}

          {#if currentItem.status}
            <span class="rounded-md bg-black/50 px-2 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/30 capitalize">
              • {currentItem.status.toLowerCase().replace(/_/g, " ")}
            </span>
          {/if}
        </div>

        <!-- Anime Title -->
        <h1 class="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white line-clamp-2 drop-shadow-md">
          {displayTitle(currentItem.title_english, currentItem.title_romaji)}
        </h1>

        <!-- Genre Tags Row -->
        {#if currentItem.genres && currentItem.genres.length > 0}
          <div class="flex flex-wrap items-center gap-1.5 mt-2.5">
            {#each currentItem.genres.slice(0, 3) as genre (genre)}
              <span class="text-xs text-white/70 font-medium">#{genre}</span>
            {/each}
            {#if currentItem.season_year}
              <span class="text-xs text-white/50">• {currentItem.season_year}</span>
            {/if}
          </div>
        {/if}

        <!-- Synopsis / Description -->
        {#if currentItem.description}
          <p class="mt-3.5 text-xs sm:text-sm leading-relaxed text-white/80 line-clamp-3 max-w-xl drop-shadow">
            {stripHtml(currentItem.description)}
          </p>
        {/if}

        <!-- Action CTAs -->
        <div class="flex flex-wrap items-center gap-3 mt-6">
          <button
            type="button"
            onclick={() => router.go(`/watch/${currentItem.anime_id}/1`)}
            class="group inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-200 hover:bg-primary/90 hover:scale-105 active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 transition-transform group-hover:scale-110">
              <path d="M6.3 2.841A1.5 1.5 0 0 0 4 4.11V15.89a1.5 1.5 0 0 0 2.3 1.269l9.344-5.89a1.5 1.5 0 0 0 0-2.538L6.3 2.84Z" />
            </svg>
            WATCH NOW
          </button>

          <button
            type="button"
            onclick={() => router.go(`/anime/${currentItem.anime_id}`)}
            class="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/20 active:scale-95"
            title="View details and episodes"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-4 w-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
            </svg>
            Details
          </button>

          <!-- Love / Like Button -->
          <button
            type="button"
            class="flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white backdrop-blur-md transition-all hover:bg-white/20 active:scale-90 {likes.isLiked(currentItem.anime_id) ? 'text-rose-500 border-rose-500/40 bg-rose-500/10' : ''}"
            onclick={() => likes.toggleLike(currentItem)}
            title={likes.isLiked(currentItem.anime_id) ? "Loved anime" : "Love this anime"}
            aria-label="Like anime"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-5 w-5 {likes.isLiked(currentItem.anime_id) ? 'text-rose-500 fill-rose-500' : 'text-white'}">
              <path d="m9.653 16.915-.005-.003-.019-.01a20.759 20.759 0 0 1-1.16-1.107 20.373 20.373 0 0 1-3.69-4.836A7.472 7.472 0 0 1 4 7.5C4 4.462 6.462 2 9.5 2a5.498 5.498 0 0 1 4.298 2.043A5.498 5.498 0 0 1 18.5 7.5c0 1.258-.337 2.44-.925 3.46a20.373 20.373 0 0 1-3.69 4.836 20.758 20.758 0 0 1-1.16 1.107l-.02.01-.005.003h-.002a.75.75 0 0 1-.698 0l-.002-.003Z" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Right Spotlight Rail Strip (The Unique Asymmetric Carousel layout) -->
      <div class="hidden lg:flex flex-col justify-between w-80 shrink-0 rounded-2xl border border-white/10 bg-black/40 p-3.5 backdrop-blur-xl">
        <div class="flex items-center justify-between border-b border-white/10 pb-2.5">
          <span class="text-xs font-bold uppercase tracking-wider text-white/90">Top Spotlights</span>
          <!-- Slider Navigation Arrows & Index -->
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              onclick={prevSlide}
              class="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white transition-colors hover:bg-white/20 active:scale-95"
              aria-label="Previous slide"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5">
                <path fill-rule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clip-rule="evenodd" />
              </svg>
            </button>
            <span class="text-xs font-mono font-bold text-white/80 px-1">
              {currentIndex + 1} / {validItems.length}
            </span>
            <button
              type="button"
              onclick={nextSlide}
              class="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white transition-colors hover:bg-white/20 active:scale-95"
              aria-label="Next slide"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5">
                <path fill-rule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Vertical upcoming slides preview list -->
        <div class="flex flex-col gap-2 my-2 overflow-y-auto max-h-[340px] pr-1">
          {#each validItems.slice(0, 5) as item, idx (item.anime_id)}
            <button
              type="button"
              onclick={() => goToSlide(idx)}
              class="group flex items-center gap-3 rounded-xl p-2 text-left transition-all {currentIndex === idx ? 'bg-primary/20 border border-primary/50 ring-1 ring-primary/40' : 'hover:bg-white/5 border border-transparent'}"
            >
              <!-- Mini cover -->
              <div class="relative h-12 w-9 shrink-0 overflow-hidden rounded-md bg-muted">
                {#if item.cover_image}
                  <img src={item.cover_image} alt="" class="h-full w-full object-cover" />
                {/if}
                <span class="absolute top-0.5 left-0.5 rounded bg-black/80 px-1 py-0.2 text-[8px] font-bold text-white">
                  #{idx + 1}
                </span>
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-xs font-semibold text-white group-hover:text-primary transition-colors">
                  {displayTitle(item.title_english, item.title_romaji)}
                </p>
                <p class="text-[10px] text-white/60 mt-0.5">
                  {[item.format, item.season_year].filter(Boolean).join(" · ")}
                </p>
              </div>
            </button>
          {/each}
        </div>

        <!-- Progress ticker bar -->
        <div class="h-1 w-full bg-white/10 rounded-full overflow-hidden">
          <div
            class="h-full bg-primary transition-all duration-300"
            style="width: {((currentIndex + 1) / items.length) * 100}%"
          ></div>
        </div>
      </div>
    </div>
  </section>
{/if}

<style>
  /* Scale the 16:9 YouTube iframe so it covers the stage with no letterboxing,
     regardless of the stage's own aspect ratio. */
  .hero-video-stage {
    container-type: size;
    overflow: hidden;
    pointer-events: none;
    transition: opacity 0.7s ease-out;
  }

  /* :global because this iframe is injected by the YouTube IFrame API, not
     by Svelte's template, so it never receives the scoped-style class. */
  :global(.hero-video-stage iframe) {
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
