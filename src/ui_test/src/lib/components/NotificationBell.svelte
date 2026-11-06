<script lang="ts">
  import { onMount } from "svelte";
  import { notificationHistory, type NotificationEntry } from "$lib/stores/notificationHistory.svelte";
  import { router } from "$lib/router.svelte";

  let open = $state(false);
  let container: HTMLDivElement | undefined;

  onMount(() => {
    notificationHistory.startSync();
  });

  function toggleOpen(): void {
    open = !open;
  }

  function openNotification(n: NotificationEntry): void {
    notificationHistory.markRead(n.id);
    open = false;
    if (n.anime_id) {
      router.go(`/anime/${n.anime_id}`);
    } else if (n.url) {
      router.go(n.url);
    }
  }

  function timeAgo(iso: string): string {
    const diffMs = Date.now() - new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z").getTime();
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
      <span class="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-extrabold text-white ring-2 ring-background shadow-xs animate-pulse">
        {notificationHistory.unreadCount > 99 ? "99+" : notificationHistory.unreadCount}
      </span>
    {/if}
  </button>

  {#if open}
    <div
      role="menu"
      class="absolute right-0 top-full z-50 mt-2 w-84 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-border/80 bg-popover text-popover-foreground shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-1 duration-150"
    >
      <div class="flex items-center justify-between border-b border-border/70 px-4 py-3">
        <div class="flex items-center gap-2">
          <span class="text-sm font-bold tracking-tight">Notifications</span>
          {#if notificationHistory.unreadCount > 0}
            <span class="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
              {notificationHistory.unreadCount} new
            </span>
          {/if}
        </div>
        {#if notificationHistory.items.length > 0}
          <div class="flex items-center gap-3">
            <button
              type="button"
              class="text-xs font-semibold text-primary transition-opacity hover:opacity-80"
              onclick={() => notificationHistory.markAllRead()}
            >
              Mark all read
            </button>
            <button
              type="button"
              class="text-xs font-semibold text-muted-foreground transition-colors hover:text-red-400"
              onclick={() => notificationHistory.clear()}
              title="Clear all notifications"
            >
              Clear all
            </button>
          </div>
        {/if}
      </div>

      <div class="max-h-[26rem] overflow-y-auto divide-y divide-border/40">
        {#if notificationHistory.items.length === 0}
          <div class="flex flex-col items-center justify-center px-4 py-10 text-center">
            <span class="text-2xl mb-2">🔔</span>
            <p class="text-xs font-medium text-muted-foreground">
              No notifications yet — site announcements, alerts, and episode updates will show up here.
            </p>
          </div>
        {:else}
          {#each notificationHistory.items as n (n.id)}
            <div class="group relative">
            <button
              type="button"
              role="menuitem"
              onclick={() => openNotification(n)}
              class="flex w-full items-start gap-3 p-3.5 pr-8 text-left transition-colors hover:bg-accent/70 {n.read ? 'opacity-65' : 'bg-primary/5'}"
            >
              <div class="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/50 bg-card shadow-xs">
                {#if n.cover}
                  <img src={n.cover} alt="" class="h-full w-full object-cover" />
                {:else if n.type === "announcement"}
                  <span class="text-lg">📢</span>
                {:else if n.type === "feedback"}
                  <span class="text-lg">💬</span>
                {:else if n.type === "system"}
                  <span class="text-lg">⚡</span>
                {:else}
                  <span class="text-lg">🔔</span>
                {/if}
              </div>
              <div class="min-w-0 flex-1">
                <p class="flex items-center gap-1.5 truncate text-[10px] font-bold uppercase tracking-wider">
                  {#if !n.read}
                    <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-primary animate-ping"></span>
                  {/if}
                  <span class={n.type === 'announcement' ? 'text-primary' : n.type === 'feedback' ? 'text-emerald-400 font-bold' : n.type === 'system' ? 'text-sky-400' : n.type === 'episode' ? 'text-rose-400' : 'text-amber-400'}>
                    {n.type === "announcement" ? "Announcement" : n.type === "feedback" ? "Feedback" : n.type === "system" ? "System Alert" : n.type === "episode" ? "New Episode" : "Discovery"}
                  </span>
                </p>
                <p class="mt-0.5 truncate text-sm font-semibold text-foreground">{n.title}</p>
                <p class="mt-0.5 break-words line-clamp-2 text-xs text-muted-foreground leading-relaxed">{n.message}</p>
                <p class="mt-1 text-[10px] font-medium text-muted-foreground/70">{timeAgo(n.created_at)}</p>
              </div>
            </button>
            <!-- Per-item dismiss (stays gone — tombstoned against re-sync) -->
            <button
              type="button"
              onclick={(e) => {
                e.stopPropagation();
                notificationHistory.dismiss(n.id);
              }}
              class="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-md text-xs text-muted-foreground opacity-0 transition-all hover:bg-accent hover:text-red-400 group-hover:opacity-100"
              title="Dismiss notification"
              aria-label="Dismiss notification"
            >
              ✕
            </button>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>
