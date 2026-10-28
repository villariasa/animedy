<script lang="ts">
  import { apiPost, ApiError } from "$lib/api/client";
  import type { HistoryListItem, HistoryListResponse } from "$lib/api/types";
  import { Button } from "$lib/components/ui/button";
  import { displayTitle } from "$lib/format";
  import { router } from "$lib/router.svelte";
  import { auth } from "$lib/stores/auth.svelte";

  const PAGE_SIZE = 25;

  let items = $state<HistoryListItem[]>([]);
  let total = $state(0);
  let offset = $state(0);
  let loading = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    if (auth.isLoggedIn) {
      void load(0);
    }
  });

  async function load(newOffset: number): Promise<void> {
    loading = true;
    error = null;
    try {
      const res = await apiPost<HistoryListResponse>("/api/history/list", {
        limit: PAGE_SIZE,
        offset: newOffset
      });
      items = newOffset === 0 ? res.items : [...items, ...res.items];
      total = res.total;
      offset = newOffset;
    } catch (err) {
      error = err instanceof ApiError ? err.message : "Failed to load history.";
    } finally {
      loading = false;
    }
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleString();
  }
</script>

<h2 class="mb-4 text-xl font-semibold">Watch History</h2>

{#if !auth.isLoggedIn}
  <p class="text-sm text-muted-foreground">
    Log in to see your cross-device watch history. Guest progress stays on this device.
  </p>
{:else if error}
  <p class="text-sm text-destructive">{error}</p>
{:else if items.length === 0 && !loading}
  <p class="text-sm text-muted-foreground">Nothing watched yet.</p>
{:else}
  <ul class="divide-y divide-border rounded-lg border border-border">
    {#each items as item (item.episode_id + item.last_watched_at)}
      <li>
        <button
          type="button"
          class="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-left hover:bg-accent"
          onclick={() => router.go(`/watch/${item.anime_id}/${item.episode_id}`)}
        >
          <span class="min-w-0 flex-1 truncate text-sm font-medium">
            {displayTitle(item.title_english, item.title_romaji)}
          </span>
          <span class="text-sm text-muted-foreground">
            Ep {item.episode_number}{item.episode_title ? ` · ${item.episode_title}` : ""}
          </span>
          {#if item.completed}
            <span class="rounded bg-primary/15 px-1.5 py-0.5 text-xs text-primary">Completed</span>
          {/if}
          <span class="text-xs text-muted-foreground">{formatDate(item.last_watched_at)}</span>
        </button>
      </li>
    {/each}
  </ul>
  {#if items.length < total}
    <div class="mt-4 text-center">
      <Button variant="outline" disabled={loading} onclick={() => void load(offset + PAGE_SIZE)}>
        {loading ? "Loading…" : `Load more (${items.length}/${total})`}
      </Button>
    </div>
  {/if}
{/if}
