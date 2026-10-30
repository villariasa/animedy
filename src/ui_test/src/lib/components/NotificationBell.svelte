<script lang="ts">
  import { notificationHistory } from "$lib/stores/notificationHistory.svelte";
  import { router } from "$lib/router.svelte";

  let open = $state(false);
  let container: HTMLDivElement | undefined;

  function toggleOpen(): void {
    open = !open;
  }

  function openNotification(id: string, animeId: number): void {
    notificationHistory.markRead(id);
    open = false;
    router.go(`/anime/${animeId}`);
  }

  function timeAgo(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function onWindowPointerDown(e: PointerEvent): void {
    if (open && container && !container.contains(e.target as Node)) {
      open = false;
    }
  }

  function onWindowKeydown(e: KeyboardEvent): void {
    if (e.key === "Escape") open = false;
  }
</script>

<svelte:window onpointerdown={onWindowPointerDown} onkeydown={onWindowKeydown} />

<div class="relative" bind:this={container}>
  <button
    type="button"
    onclick={toggleOpen}
    class="relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl text-muted-foreground transition-all hover:bg-accent hover:text-primary active:scale-95 {open ? 'bg-accent text-primary' : ''}"
    title="Notifications"
    aria-label="Notifications"
    aria-haspopup="menu"
    aria-expanded={open}
  >
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4.5 w-4.5 sm:h-5 sm:w-5">
      <path fill-rule="evenodd" d="M10 2a6 6 0 0 0-6 6c0 1.887-.454 3.665-1.257 5.234a.75.75 0 0 0 .515 1.076 32.91 32.91 0 0 0 3.256.508 3.5 3.5 0 0 0 6.972 0 32.903 32.903 0 0 0 3.256-.508.75.75 0 0 0 .515-1.076A11.448 11.448 0 0 1 16 8a6 6 0 0 0-6-6ZM8.05 14.943a33.54 33.54 0 0 0 3.9 0 2 2 0 0 1-3.9 0Z" clip-rule="evenodd" />
    </svg>
    {#if notificationHistory.unreadCount > 0}
      <span class="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-background">
        {notificationHistory.unreadCount > 9 ? "9+" : notificationHistory.unreadCount}
      </span>
    {/if}
  </button>

  {#if open}
    <div
      role="menu"
      class="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-border/80 bg-popover text-popover-foreground shadow-2xl"
    >
      <div class="flex items-center justify-between border-b border-border/70 px-3.5 py-2.5">
        <span class="text-sm font-bold">Notifications</span>
        {#if notificationHistory.items.length > 0}
          <button
            type="button"
            class="text-xs font-semibold text-primary hover:underline"
            onclick={() => notificationHistory.markAllRead()}
          >
            Mark all read
          </button>
        {/if}
      </div>

      <div class="max-h-96 overflow-y-auto">
        {#if notificationHistory.items.length === 0}
          <p class="px-4 py-8 text-center text-xs text-muted-foreground">
            No notifications yet — updates for Liked/My List episodes and discovery picks will show up here.
          </p>
        {:else}
          {#each notificationHistory.items as n (n.id)}
            <button
              type="button"
              role="menuitem"
              onclick={() => openNotification(n.id, n.anime_id)}
              class="flex w-full items-start gap-2.5 border-b border-border/40 px-3.5 py-3 text-left transition-colors hover:bg-accent last:border-b-0 {n.read ? 'opacity-60' : ''}"
            >
              <div class="relative h-12 w-9 shrink-0 overflow-hidden rounded-md bg-muted">
                {#if n.cover}
                  <img src={n.cover} alt="" class="h-full w-full object-cover" />
                {/if}
              </div>
              <div class="min-w-0 flex-1">
                <p class="flex items-center gap-1.5 truncate text-[10px] font-bold uppercase tracking-wide {n.type === 'episode' ? 'text-rose-400' : 'text-amber-400'}">
                  {#if !n.read}
                    <span class="h-1.5 w-1.5 shrink-0 rounded-full {n.type === 'episode' ? 'bg-rose-500' : 'bg-amber-500'}"></span>
                  {/if}
                  {n.type === "episode" ? "New Episode" : "Discovery"}
                </p>
                <p class="truncate text-sm font-semibold">{n.title}</p>
                <p class="truncate text-xs text-muted-foreground">{n.message}</p>
                <p class="mt-0.5 text-[10px] text-muted-foreground/70">{timeAgo(n.created_at)}</p>
              </div>
            </button>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>
