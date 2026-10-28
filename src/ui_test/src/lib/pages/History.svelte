<script lang="ts">
  import { ApiError } from "$lib/api/client";
  import { apiPostCached } from "$lib/api/cached";
  import type { HistoryListItem, HistoryListResponse } from "$lib/api/types";
  import { getAllLocalProgress, clearLocalProgress, type LocalProgress } from "$lib/db/local";
  import { Button } from "$lib/components/ui/button";
  import { displayTitle, formatTime } from "$lib/format";
  import { router } from "$lib/router.svelte";
  import { auth } from "$lib/stores/auth.svelte";

  interface DisplayHistoryItem {
    key: string;
    anime_id: number;
    episode_id: number;
    episode_number: number;
    title: string;
    episode_title?: string | null;
    cover_image?: string | null;
    position_seconds: number;
    duration_seconds: number;
    completed: boolean;
    last_watched_at: string;
  }

  let items = $state<DisplayHistoryItem[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    // Re-run whenever login state flips
    void loadHistory(auth.isLoggedIn);
  });

  async function loadHistory(isLoggedIn: boolean): Promise<void> {
    loading = true;
    error = null;
    try {
      if (isLoggedIn) {
        const res = await apiPostCached<HistoryListResponse>("/api/history/list", {
          limit: 50,
          offset: 0
        });
        items = res.items.map((item) => ({
          key: `${item.episode_id}-${item.last_watched_at}`,
          anime_id: item.anime_id,
          episode_id: item.episode_id,
          episode_number: item.episode_number,
          title: displayTitle(item.title_english, item.title_romaji),
          episode_title: item.episode_title,
          cover_image: null,
          position_seconds: 0,
          duration_seconds: 0,
          completed: item.completed,
          last_watched_at: item.last_watched_at
        }));
      } else {
        // Guest mode: load from IndexedDB
        const local = await getAllLocalProgress();
        // Sort newest first
        local.sort((a, b) => new Date(b.last_watched_at).getTime() - new Date(a.last_watched_at).getTime());
        items = local.map((l) => ({
          key: `${l.episode_id}-${l.last_watched_at}`,
          anime_id: l.anime_id,
          episode_id: l.episode_id,
          episode_number: l.episode_number ?? (l.episode_id % 1000),
          title: displayTitle(l.title_english ?? null, l.title_romaji ?? null) || `Anime #${l.anime_id}`,
          episode_title: l.episode_title,
          cover_image: l.cover_image ?? null,
          position_seconds: l.position_seconds,
          duration_seconds: l.duration_seconds,
          completed: l.completed,
          last_watched_at: l.last_watched_at
        }));
      }
    } catch (err) {
      error = err instanceof ApiError ? err.message : "Failed to load watch history.";
    } finally {
      loading = false;
    }
  }

  async function handleClearHistory(): Promise<void> {
    if (!confirm("Are you sure you want to clear your watch history on this device?")) return;
    await clearLocalProgress().catch(() => undefined);
    items = [];
  }

  function formatRelative(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
  }
</script>

<div class="flex flex-col gap-6">
  <!-- Header -->
  <div class="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
    <div class="flex items-center gap-2.5">
      <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-5 w-5" aria-hidden="true">
          <path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clip-rule="evenodd" />
        </svg>
      </span>
      <div>
        <h2 class="text-2xl font-bold tracking-tight">Watch History</h2>
        <p class="text-xs text-muted-foreground">
          {#if auth.isLoggedIn}
            Synced cross-device history ({items.length} records)
          {:else}
            Guest history saved locally on this browser ({items.length} records)
          {/if}
        </p>
      </div>
    </div>

    {#if items.length > 0 && !auth.isLoggedIn}
      <Button variant="outline" size="sm" class="text-xs text-muted-foreground hover:text-destructive" onclick={handleClearHistory}>
        Clear History
      </Button>
    {/if}
  </div>

  {#if loading}
    <div class="flex flex-col items-center justify-center py-20">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
      <p class="mt-3 text-xs text-muted-foreground">Loading history…</p>
    </div>
  {:else if error}
    <div class="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-center text-sm text-destructive">
      {error}
    </div>
  {:else if items.length === 0}
    <div class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
      <div class="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      </div>
      <h3 class="mt-4 text-base font-semibold">No watch history yet</h3>
      <p class="mt-1 max-w-sm text-xs text-muted-foreground">
        When you stream anime episodes, your watched titles and playback progress will appear right here!
      </p>
      <Button class="mt-5" onclick={() => router.go("/")}>Start Watching</Button>
    </div>
  {:else}
    <ul class="divide-y divide-border/60 rounded-xl border border-border/80 bg-card/60 shadow-sm backdrop-blur">
      {#each items as item (item.key)}
        {@const progressPercent = item.duration_seconds > 0 ? Math.min(100, Math.round((item.position_seconds / item.duration_seconds) * 100)) : 0}
        <li>
          <div class="group flex flex-col gap-3 p-4 transition-colors hover:bg-accent/50 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              class="flex flex-1 items-center gap-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
              onclick={() => router.go(`/watch/${item.anime_id}/${item.episode_id}`)}
            >
              <!-- Poster / Thumbnail Preview -->
              <div class="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-muted shadow-sm ring-1 ring-border/50">
                {#if item.cover_image}
                  <img src={item.cover_image} alt="" class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                {:else}
                  <div class="flex h-full w-full items-center justify-center bg-primary/10 text-primary">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-6 w-6">
                      <path d="M6.3 2.841A1.5 1.5 0 0 0 4 4.11V15.89a1.5 1.5 0 0 0 2.3 1.269l9.344-5.89a1.5 1.5 0 0 0 0-2.538L6.3 2.84Z" />
                    </svg>
                  </div>
                {/if}

                <!-- Progress Bar at bottom of thumbnail -->
                <div class="absolute inset-x-0 bottom-0 h-1 bg-black/60">
                  <div class="h-full bg-primary" style="width: {progressPercent}%"></div>
                </div>
              </div>

              <!-- Details -->
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                    EP {item.episode_number}
                  </span>
                  {#if item.completed}
                    <span class="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
                      Finished
                    </span>
                  {/if}
                  <span class="text-xs text-muted-foreground">{formatRelative(item.last_watched_at)}</span>
                </div>
                <h4 class="mt-1 truncate text-sm font-semibold tracking-tight transition-colors group-hover:text-primary">
                  {item.title}
                </h4>
                <p class="mt-0.5 text-xs text-muted-foreground">
                  {item.episode_title && item.episode_title !== `Episode ${item.episode_number}` ? item.episode_title : `Episode ${item.episode_number}`}
                  {#if item.position_seconds > 0}
                    · Resumes at {formatTime(item.position_seconds)} ({progressPercent}%)
                  {/if}
                </p>
              </div>
            </button>

            <!-- Action Button -->
            <div class="flex items-center justify-end gap-2 shrink-0">
              <Button size="sm" class="gap-1 text-xs" onclick={() => router.go(`/watch/${item.anime_id}/${item.episode_id}`)}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5">
                  <path d="M6.3 2.841A1.5 1.5 0 0 0 4 4.11V15.89a1.5 1.5 0 0 0 2.3 1.269l9.344-5.89a1.5 1.5 0 0 0 0-2.538L6.3 2.84Z" />
                </svg>
                {item.position_seconds > 0 ? "Resume" : "Watch"}
              </Button>
            </div>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>
