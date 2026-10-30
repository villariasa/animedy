<script lang="ts">
  import {
    watchStatusStore,
    WATCH_STATUS_ORDER,
    WATCH_STATUS_LABELS,
    type WatchStatus
  } from "$lib/stores/watchStatus.svelte";
  import { customLists } from "$lib/stores/customLists.svelte";

  let {
    anime,
    buttonClass = "flex h-7 w-7 items-center justify-center rounded-full bg-black/75 shadow backdrop-blur transition-transform hover:scale-110 active:scale-90",
    iconClass = "h-4 w-4"
  }: {
    anime: {
      anime_id: number;
      title_english?: string | null;
      title_romaji?: string | null;
      cover_image?: string | null;
      format?: string | null;
      season_year?: number | null;
    };
    buttonClass?: string;
    iconClass?: string;
  } = $props();

  let open = $state(false);
  let container: HTMLDivElement | undefined;
  let triggerButton: HTMLButtonElement | undefined;
  let menuPos = $state({ top: 0, left: 0 });

  const currentStatus = $derived(watchStatusStore.getStatus(anime.anime_id));
  const inAnyCustomList = $derived(customLists.listsContaining(anime.anime_id).length > 0);

  let creatingList = $state(false);
  let newListName = $state("");

  function startCreateList(): void {
    creatingList = true;
    newListName = "";
  }

  function submitCreateList(): void {
    const list = customLists.create(newListName);
    if (list) {
      customLists.addAnime(list.id, anime);
    }
    creatingList = false;
    newListName = "";
  }

  // Cards live inside overflow-hidden grid items, so the menu is positioned
  // fixed off the trigger's screen rect instead of relying on absolute +
  // ancestor overflow (which would clip it).
  function toggleOpen(e: MouseEvent): void {
    e.stopPropagation();
    if (!open && triggerButton) {
      const rect = triggerButton.getBoundingClientRect();
      menuPos = { top: rect.bottom + 6, left: Math.max(8, rect.right - 160) };
    }
    open = !open;
  }

  function pick(status: WatchStatus): void {
    if (currentStatus === status) {
      watchStatusStore.clearStatus(anime.anime_id);
    } else {
      watchStatusStore.setStatus(anime, status);
    }
    open = false;
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
    bind:this={triggerButton}
    class="{buttonClass} {currentStatus || inAnyCustomList ? 'text-primary' : 'text-white/80 hover:text-primary'}"
    onclick={toggleOpen}
    title={currentStatus ? `In your list: ${WATCH_STATUS_LABELS[currentStatus]}` : "Add to list"}
    aria-label="Add to list"
    aria-haspopup="menu"
    aria-expanded={open}
  >
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class={iconClass}>
      {#if currentStatus || inAnyCustomList}
        <path d="M4 3.5A1.5 1.5 0 0 1 5.5 2h9A1.5 1.5 0 0 1 16 3.5v14.09a.5.5 0 0 1-.8.4L10 13.5l-5.2 4.49a.5.5 0 0 1-.8-.4V3.5Z" />
      {:else}
        <path fill-rule="evenodd" d="M5.5 3.5A.5.5 0 0 1 6 3h8a.5.5 0 0 1 .5.5v13.09a.5.5 0 0 1-.8.4L10 13.5l-3.7 3.49a.5.5 0 0 1-.8-.4V3.5ZM10 7a.75.75 0 0 1 .75.75v.75h.75a.75.75 0 0 1 0 1.5h-.75v.75a.75.75 0 0 1-1.5 0v-.75h-.75a.75.75 0 0 1 0-1.5h.75v-.75A.75.75 0 0 1 10 7Z" clip-rule="evenodd" />
      {/if}
    </svg>
  </button>

  {#if open}
    <div
      role="menu"
      class="fixed z-50 w-48 overflow-hidden rounded-lg border border-border/80 bg-popover text-popover-foreground shadow-lg"
      style="top: {menuPos.top}px; left: {menuPos.left}px;"
    >
      {#each WATCH_STATUS_ORDER as status (status)}
        <button
          type="button"
          role="menuitem"
          class="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-accent {currentStatus === status ? 'text-primary' : ''}"
          onclick={(e) => {
            e.stopPropagation();
            pick(status);
          }}
        >
          {WATCH_STATUS_LABELS[status]}
          {#if currentStatus === status}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5">
              <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" />
            </svg>
          {/if}
        </button>
      {/each}
      {#if currentStatus}
        <button
          type="button"
          role="menuitem"
          class="flex w-full items-center px-3 py-2 text-left text-xs font-medium text-destructive transition-colors hover:bg-accent"
          onclick={(e) => {
            e.stopPropagation();
            watchStatusStore.clearStatus(anime.anime_id);
            open = false;
          }}
        >
          Remove from list
        </button>
      {/if}

      <!-- Custom (user-named) lists — an anime can be in several at once -->
      <div class="border-t border-border/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        Your Lists
      </div>
      <div class="max-h-36 overflow-y-auto">
        {#each customLists.lists as list (list.id)}
          {@const inList = customLists.isInList(list.id, anime.anime_id)}
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={inList}
            class="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-accent {inList ? 'text-primary' : ''}"
            onclick={(e) => {
              e.stopPropagation();
              customLists.toggleAnime(list.id, anime);
            }}
          >
            <span class="truncate">{list.name}</span>
            {#if inList}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5 shrink-0">
                <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" />
              </svg>
            {/if}
          </button>
        {/each}
      </div>

      {#if creatingList}
        <form
          class="flex items-center gap-1.5 border-t border-border/80 px-2.5 py-2"
          onsubmit={(e) => {
            e.preventDefault();
            submitCreateList();
          }}
        >
          <input
            type="text"
            bind:value={newListName}
            placeholder="List name…"
            autofocus
            class="h-7 min-w-0 flex-1 rounded-md border border-border/80 bg-background/80 px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          />
          <button
            type="submit"
            class="shrink-0 rounded-md bg-primary px-2 py-1 text-[11px] font-bold text-primary-foreground"
          >
            Add
          </button>
        </form>
      {:else}
        <button
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-1.5 border-t border-border/80 px-3 py-2 text-left text-xs font-semibold text-primary transition-colors hover:bg-accent"
          onclick={(e) => {
            e.stopPropagation();
            startCreateList();
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5">
            <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
          </svg>
          New list
        </button>
      {/if}
    </div>
  {/if}
</div>
