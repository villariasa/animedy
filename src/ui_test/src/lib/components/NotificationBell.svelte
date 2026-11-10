<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { notificationHistory, type NotificationEntry } from "$lib/stores/notificationHistory.svelte";
  import { router } from "$lib/router.svelte";

  let open = $state(false);
  let container: HTMLDivElement | undefined;
  let expandedIds = $state<Set<string>>(new Set());

  onMount(() => {
    notificationHistory.startSync();
  });

  function toggleOpen(): void {
    open = !open;
  }

  function toggleExpand(id: string, e?: MouseEvent): void {
    if (e) e.stopPropagation();
    notificationHistory.markRead(id);
    const next = new Set(expandedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    expandedIds = next;
  }

  function openNotification(n: NotificationEntry): void {
    notificationHistory.markRead(n.id);
    if (n.anime_id) {
      open = false;
      router.go(`/anime/${n.anime_id}`);
    } else if (n.url) {
      open = false;
      router.go(n.url);
    } else {
      // For announcements or notifications without a link, toggle inline read
      toggleExpand(n.id);
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
      class="absolute right-0 top-full z-50 mt-2 w-84 max-w-[calc(100vw-1.5rem)] sm:w-96 overflow-hidden rounded-2xl border border-border/80 bg-popover text-popover-foreground shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-1 duration-150"
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
              class="text-xs font-semibold text-primary transition-opacity hover:opacity-80 cursor-pointer"
              onclick={() => notificationHistory.markAllRead()}
            >
              Mark all read
            </button>
            <button
              type="button"
              class="text-xs font-semibold text-muted-foreground transition-colors hover:text-red-400 cursor-pointer"
              onclick={() => notificationHistory.clear()}
              title="Clear all notifications"
            >
              Clear all
            </button>
          </div>
        {/if}
      </div>

      <div class="max-h-[28rem] overflow-y-auto divide-y divide-border/40">
        {#if notificationHistory.items.length === 0}
          <div class="flex flex-col items-center justify-center px-4 py-10 text-center">
            <Icon name="bell" class="mb-2 h-7 w-7 text-muted-foreground/60" />
            <p class="text-xs font-medium text-muted-foreground">
              No notifications yet — site announcements, alerts, and episode updates will show up here.
            </p>
          </div>
        {:else}
          {#each notificationHistory.items as n (n.id)}
            <div class="group relative">
              <div
                class="flex w-full items-start gap-3 p-3.5 pr-8 text-left transition-colors hover:bg-accent/70 {n.read ? 'opacity-75' : 'bg-primary/5'}"
              >
                <!-- Thumbnail / Icon -->
                <button
                  type="button"
                  class="relative flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-border/50 bg-card shadow-xs transition-transform hover:scale-105 active:scale-95"
                  onclick={() => openNotification(n)}
                  aria-label={n.title}
                >
                  {#if n.cover}
                    <img src={n.cover} alt="" class="h-full w-full object-cover" />
                  {:else if n.type === "announcement"}
                    <Icon name="megaphone" class="h-5 w-5 text-primary" />
                  {:else if n.type === "feedback"}
                    <Icon name="chat" class="h-5 w-5 text-emerald-400" />
                  {:else if n.type === "system"}
                    <Icon name="bolt" class="h-5 w-5 text-sky-400" />
                  {:else}
                    <Icon name="bell" class="h-5 w-5 text-amber-400" />
                  {/if}
                </button>

                <!-- Body -->
                <div class="min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-1">
                    <p class="flex items-center gap-1.5 truncate text-[10px] font-bold uppercase tracking-wider">
                      {#if !n.read}
                        <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-primary animate-ping"></span>
                      {/if}
                      <span class={n.type === 'announcement' ? 'text-primary' : n.type === 'feedback' ? 'text-emerald-400 font-bold' : n.type === 'system' ? 'text-sky-400' : n.type === 'episode' ? 'text-rose-400' : 'text-amber-400'}>
                        {n.type === "announcement" ? "Announcement" : n.type === "feedback" ? "Feedback" : n.type === "system" ? "System Alert" : n.type === "episode" ? "New Episode" : "Discovery"}
                      </span>
                    </p>
                    <span class="text-[10px] font-medium text-muted-foreground/70">{timeAgo(n.created_at)}</span>
                  </div>

                  <button
                    type="button"
                    onclick={() => openNotification(n)}
                    class="mt-0.5 block w-full text-left text-sm font-semibold text-foreground hover:text-primary transition-colors cursor-pointer"
                  >
                    {n.title}
                  </button>

                  {#if expandedIds.has(n.id)}
                    <div class="mt-1.5 whitespace-pre-wrap break-words rounded-xl border border-border/70 bg-card/80 p-3 text-xs text-foreground/95 leading-relaxed shadow-xs">
                      {n.message}
                    </div>
                    <button
                      type="button"
                      onclick={(e) => toggleExpand(n.id, e)}
                      class="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                    >
                      Show less ▲
                    </button>
                  {:else}
                    <p class="mt-0.5 break-words line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                      {n.message}
                    </p>
                    {#if n.message.length > 70 || n.message.includes("\n")}
                      <button
                        type="button"
                        onclick={(e) => toggleExpand(n.id, e)}
                        class="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                      >
                        Read full announcement ▼
                      </button>
                    {/if}
                  {/if}
                </div>
              </div>

              <!-- Per-item dismiss (stays gone — tombstoned against re-sync) -->
              <button
                type="button"
                onclick={(e) => {
                  e.stopPropagation();
                  notificationHistory.dismiss(n.id);
                }}
                class="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md text-xs text-muted-foreground opacity-0 transition-all hover:bg-accent hover:text-red-400 group-hover:opacity-100 cursor-pointer"
                title="Dismiss notification"
                aria-label="Dismiss notification"
              >
                <Icon name="x-mark" class="h-3.5 w-3.5" />
              </button>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>
