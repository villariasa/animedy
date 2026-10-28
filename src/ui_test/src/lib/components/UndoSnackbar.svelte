<script lang="ts">
  import { displayTitle } from "$lib/format";
  import { likes } from "$lib/stores/likes.svelte";

  const DISMISS_MS = 5000;

  // Re-arm the auto-dismiss timer every time a new action lands.
  $effect(() => {
    const action = likes.lastAction;
    if (action) {
      const timer = setTimeout(() => {
        if (likes.lastAction === action) {
          likes.dismissUndo();
        }
      }, DISMISS_MS);
      return () => clearTimeout(timer);
    }
  });
</script>

{#if likes.lastAction}
  {@const action = likes.lastAction}
  {@const title = displayTitle(action.item.title_english, action.item.title_romaji)}
  <div
    class="fixed bottom-5 left-1/2 z-[80] flex w-[min(92vw,26rem)] -translate-x-1/2 items-center gap-3 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-2xl backdrop-blur"
    role="status"
    aria-live="polite"
  >
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
         class="h-4 w-4 shrink-0 {action.type === 'liked' ? 'text-rose-500' : 'text-muted-foreground'}">
      <path d="m9.653 16.915-.005-.003-.019-.01a20.759 20.759 0 0 1-1.16-1.107 20.373 20.373 0 0 1-3.69-4.836A7.472 7.472 0 0 1 4 7.5C4 4.462 6.462 2 9.5 2a5.498 5.498 0 0 1 4.298 2.043A5.498 5.498 0 0 1 18.5 7.5c0 1.258-.337 2.44-.925 3.46a20.373 20.373 0 0 1-3.69 4.836 20.758 20.758 0 0 1-1.16 1.107l-.02.01-.005.003h-.002a.75.75 0 0 1-.698 0l-.002-.003Z" />
    </svg>
    <p class="min-w-0 flex-1 truncate text-sm">
      {action.type === "liked" ? "Added" : "Removed"}
      <span class="font-semibold">{title}</span>
      {action.type === "liked" ? "to Liked" : "from Liked"}
    </p>
    <button
      type="button"
      class="shrink-0 rounded-lg bg-primary/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary transition-colors hover:bg-primary/25"
      onclick={() => likes.undo()}
    >
      Undo
    </button>
    <button
      type="button"
      class="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:text-foreground"
      onclick={() => likes.dismissUndo()}
      aria-label="Dismiss"
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-3.5 w-3.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
{/if}
