<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { getAiringSchedule, type AiringScheduleEntry } from "$lib/api/anilist";
  import { displayTitle } from "$lib/format";
  import { router } from "$lib/router.svelte";

  interface DayTab {
    date: Date;
    dayLabel: string;
    dayNumber: number;
    isToday: boolean;
    dateKey: string;
  }

  // Generate rolling 7-day strip centered around today (3 days before, today, 3 days after)
  let dayOffset = $state(0);
  let selectedDateKey = $state("");
  let selectedDate = $state<Date>(new Date());

  function generateDays(offset: number): DayTab[] {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    const days: DayTab[] = [];

    for (let i = -3; i <= 3; i += 1) {
      const d = new Date();
      d.setDate(today.getDate() + offset + i);
      const dateKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      days.push({
        date: d,
        dayLabel: d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
        dayNumber: d.getDate(),
        isToday: dateKey === todayKey,
        dateKey
      });
    }
    return days;
  }

  const daysList = $derived(generateDays(dayOffset));

  let items = $state<AiringScheduleEntry[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let isExpanded = $state(false);

  // Live clock updating every second
  let nowTimestamp = $state(Math.floor(Date.now() / 1000));
  let liveClockString = $state("");
  let timer: ReturnType<typeof setInterval> | undefined;

  function updateClock(): void {
    const d = new Date();
    nowTimestamp = Math.floor(d.getTime() / 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    liveClockString = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  onMount(() => {
    updateClock();
    timer = setInterval(updateClock, 1000);
    // Default select today
    const today = new Date();
    selectedDate = today;
    selectedDateKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    void loadSchedule(today);
  });

  onDestroy(() => {
    if (timer) clearInterval(timer);
  });

  async function loadSchedule(targetDate: Date): Promise<void> {
    loading = true;
    error = null;
    try {
      const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
      const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);
      const startSec = Math.floor(startOfDay.getTime() / 1000);
      const endSec = Math.floor(endOfDay.getTime() / 1000);

      items = await getAiringSchedule(startSec, endSec);
    } catch {
      items = [];
      error = "Could not load release schedule.";
    } finally {
      loading = false;
    }
  }

  function selectDay(tab: DayTab): void {
    selectedDate = tab.date;
    selectedDateKey = tab.dateKey;
    void loadSchedule(tab.date);
  }

  function shiftDays(amount: number): void {
    dayOffset += amount;
  }

  function formatCountdown(airingAt: number, now: number): { text: string; isReleased: boolean } {
    const diff = airingAt - now;
    if (diff <= 0) {
      return { text: "released", isReleased: true };
    }
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    const mins = Math.floor((diff % 3600) / 60);
    const secs = diff % 60;

    if (days > 0) {
      return { text: `${days}d ${hours}h`, isReleased: false };
    }
    if (hours > 0) {
      return { text: `${hours}h ${mins}m`, isReleased: false };
    }
    if (mins > 0) {
      return { text: `${mins}m ${secs}s`, isReleased: false };
    }
    return { text: `${secs}s`, isReleased: false };
  }

  const visibleItems = $derived(isExpanded ? items : items.slice(0, 12));
</script>

<section class="rounded-2xl border border-border/70 bg-card/50 p-4 shadow-sm backdrop-blur" aria-label="Estimated Airing Schedule">
  <!-- Header -->
  <div class="mb-3.5 flex items-center justify-between border-b border-border/50 pb-3">
    <div class="flex items-center gap-2">
      <!-- Calendar Clock icon -->
      <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor" class="h-4 w-4" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      </span>
      <div>
        <h3 class="text-sm font-bold tracking-tight">Estimated Schedule</h3>
        <p class="text-[11px] text-muted-foreground">Real-time airing countdown</p>
      </div>
    </div>
    <span class="rounded bg-muted/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
      Weekly Releases
    </span>
  </div>

  <!-- Day Navigation Carousel Bar -->
  <div class="mb-3 flex items-center justify-between gap-1">
    <!-- Prev button -->
    <button
      type="button"
      class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-95"
      onclick={() => shiftDays(-3)}
      aria-label="Previous days"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
        <path fill-rule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clip-rule="evenodd" />
      </svg>
    </button>

    <!-- Days pill tabs -->
    <div class="flex flex-1 items-center justify-around gap-1 overflow-x-auto py-1">
      {#each daysList as tab (tab.dateKey)}
        {@const active = tab.dateKey === selectedDateKey}
        <button
          type="button"
          class="flex flex-col items-center justify-center rounded-xl px-2.5 py-1.5 transition-all duration-200 min-w-[38px] {
            active
              ? 'bg-primary text-primary-foreground font-bold shadow-md shadow-primary/25 ring-2 ring-primary/40 scale-105'
              : 'bg-muted/30 text-muted-foreground hover:bg-muted/70 hover:text-foreground'
          }"
          onclick={() => selectDay(tab)}
        >
          <span class="text-[9px] font-semibold uppercase tracking-wider opacity-85">{tab.dayLabel}</span>
          <span class="text-xs font-black">{tab.dayNumber}</span>
          {#if tab.isToday && !active}
            <span class="mt-0.5 h-1 w-1 rounded-full bg-primary"></span>
          {/if}
        </button>
      {/each}
    </div>

    <!-- Next button -->
    <button
      type="button"
      class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-95"
      onclick={() => shiftDays(3)}
      aria-label="Next days"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
        <path fill-rule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
      </svg>
    </button>
  </div>

  <!-- Content List Area -->
  <div class="mt-2 min-h-[220px]">
    {#if loading}
      <div class="space-y-2 py-2">
        {#each Array(6) as _, i (i)}
          <div class="flex animate-pulse items-center justify-between gap-3 py-1.5 px-2">
            <div class="h-3.5 w-14 rounded bg-muted/60"></div>
            <div class="h-3.5 flex-1 rounded bg-muted/50"></div>
            <div class="h-3.5 w-6 rounded bg-muted/60"></div>
          </div>
        {/each}
      </div>
    {:else if error}
      <p class="py-8 text-center text-xs text-destructive">{error}</p>
    {:else if items.length === 0}
      <div class="flex flex-col items-center justify-center py-10 text-center">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-8 w-8 text-muted-foreground/40 mb-2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
        </svg>
        <p class="text-xs text-muted-foreground">No scheduled anime releases found for this day.</p>
      </div>
    {:else}
      <ul class="divide-y divide-border/30">
        {#each visibleItems as item (item.id)}
          {@const { text, isReleased } = formatCountdown(item.airing_at, nowTimestamp)}
          <li class="group flex items-center justify-between gap-3 py-2 px-2 rounded-lg transition-colors hover:bg-accent/40">
            <!-- Left: Countdown / Released Tag -->
            <span class="w-16 shrink-0 text-left text-[11px] font-medium {isReleased ? 'text-muted-foreground/40' : 'text-emerald-400 font-semibold'}">
              {text}
            </span>

            <!-- Center: Anime Title -->
            <button
              type="button"
              class="min-w-0 flex-1 truncate text-left text-xs font-semibold text-foreground/90 transition-colors group-hover:text-primary focus-visible:outline-none"
              onclick={() => router.go(`/anime/${item.anime_id}`)}
              title={displayTitle(item.title_english, item.title_romaji)}
            >
              {displayTitle(item.title_english, item.title_romaji)}
            </button>

            <!-- Right: Episode Number -->
            <span class="w-7 shrink-0 text-right text-xs font-bold text-muted-foreground/80 transition-colors group-hover:text-foreground">
              {item.episode}
            </span>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <!-- Footer with Live Timestamp and Less/More Toggle -->
  <div class="mt-3 flex items-center justify-between border-t border-border/40 pt-2.5 text-[11px] text-muted-foreground">
    <span class="font-mono text-[10px] opacity-75">{liveClockString}</span>
    {#if items.length > 12}
      <button
        type="button"
        class="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
        onclick={() => (isExpanded = !isExpanded)}
      >
        {isExpanded ? "Less ^" : `More (${items.length - 12}) v`}
      </button>
    {/if}
  </div>
</section>
