<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { router } from "$lib/router.svelte";
  import { homeReset } from "$lib/stores/homeReset.svelte";
  import { likes } from "$lib/stores/likes.svelte";
  import { watchStatusStore } from "$lib/stores/watchStatus.svelte";

  let {
    isOpen = $bindable(false),
    onClose,
  }: {
    isOpen: boolean;
    onClose?: () => void;
  } = $props();

  function close(): void {
    isOpen = false;
    onClose?.();
  }

  function handleNavigate(path: string, isHome = false): void {
    if (isHome) {
      router.go("/");
      homeReset.trigger();
    } else {
      router.go(path);
    }
    close();
  }

  $effect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      function handleKeyDown(e: KeyboardEvent): void {
        if (e.key === "Escape") {
          close();
        }
      }
      window.addEventListener("keydown", handleKeyDown);

      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  });
</script>

{#if isOpen}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm sm:hidden"
    transition:fade={{ duration: 180 }}
    onclick={close}
    onkeydown={(e) => { if (e.key === "Escape") close(); }}
    role="button"
    tabindex="0"
    aria-label="Close navigation menu backdrop"
  ></div>

  <!-- Drawer Container (slide from right) -->
  <div
    class="fixed inset-y-0 right-0 z-50 flex w-[280px] max-w-[85vw] flex-col bg-background/95 border-l border-border/80 shadow-2xl backdrop-blur-xl sm:hidden"
    transition:fly={{ x: 280, duration: 220 }}
    role="dialog"
    aria-modal="true"
    aria-label="Navigation Menu"
  >
    <!-- Header of Drawer -->
    <div class="flex items-center justify-between border-b border-border/70 px-4 py-3.5">
      <a
        href="#/"
        onclick={(e) => {
          e.preventDefault();
          handleNavigate("/", true);
        }}
        class="flex items-center gap-2 transition-opacity hover:opacity-85"
      >
        <img src="/icons/logo-small.png" alt="Animedy" class="h-7 w-auto" />
      </a>

      <button
        type="button"
        onclick={close}
        class="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-95"
        aria-label="Close menu"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-5 w-5">
          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
        </svg>
      </button>
    </div>

    <!-- Navigation Links -->
    <nav class="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Mobile Navigation">
      <!-- Home -->
      <a
        href="#/"
        onclick={(e) => {
          e.preventDefault();
          handleNavigate("/", true);
        }}
        class="flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors hover:bg-accent {router.current.name === 'home' ? 'bg-primary/15 text-primary font-semibold' : 'text-foreground/90'}"
      >
        <div class="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 {router.current.name === 'home' ? 'text-primary' : 'text-muted-foreground'}">
            <path fill-rule="evenodd" d="M9.293 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 17 11h-1v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6H3a1 1 0 0 1-.707-1.707l7-7Z" clip-rule="evenodd" />
          </svg>
          <span>Home</span>
        </div>
      </a>

      <!-- Liked -->
      <a
        href="#/favorites"
        onclick={(e) => {
          e.preventDefault();
          handleNavigate("/favorites");
        }}
        class="flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors hover:bg-accent {router.current.name === 'favorites' ? 'bg-primary/15 text-primary font-semibold' : 'text-foreground/90'}"
      >
        <div class="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 text-rose-500">
            <path d="m9.653 16.915-.005-.003-.019-.01a20.759 20.759 0 0 1-1.16-1.107 20.373 20.373 0 0 1-3.69-4.836A7.472 7.472 0 0 1 4 7.5C4 4.462 6.462 2 9.5 2a5.498 5.498 0 0 1 4.298 2.043A5.498 5.498 0 0 1 18.5 7.5c0 1.258-.337 2.44-.925 3.46a20.373 20.373 0 0 1-3.69 4.836 20.758 20.758 0 0 1-1.16 1.107l-.02.01-.005.003h-.002a.75.75 0 0 1-.698 0l-.002-.003Z" />
          </svg>
          <span>Liked</span>
        </div>
        {#if likes.count > 0}
          <span class="rounded-full bg-rose-500/20 px-2 py-0.5 text-xs font-bold text-rose-400">
            {likes.count}
          </span>
        {/if}
      </a>

      <!-- My List -->
      <a
        href="#/mylist"
        onclick={(e) => {
          e.preventDefault();
          handleNavigate("/mylist");
        }}
        class="flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors hover:bg-accent {router.current.name === 'mylist' ? 'bg-primary/15 text-primary font-semibold' : 'text-foreground/90'}"
      >
        <div class="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 text-primary">
            <path fill-rule="evenodd" d="M4 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v14l-6-3-6 3V4Z" clip-rule="evenodd" />
          </svg>
          <span>My List</span>
        </div>
        {#if watchStatusStore.count > 0}
          <span class="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-bold text-primary">
            {watchStatusStore.count}
          </span>
        {/if}
      </a>

      <!-- History -->
      <a
        href="#/history"
        onclick={(e) => {
          e.preventDefault();
          handleNavigate("/history");
        }}
        class="flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors hover:bg-accent {router.current.name === 'history' ? 'bg-primary/15 text-primary font-semibold' : 'text-foreground/90'}"
      >
        <div class="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 {router.current.name === 'history' ? 'text-primary' : 'text-muted-foreground'}">
            <path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .2.08.39.22.53l3 3a.75.75 0 0 0 1.06-1.06l-2.78-2.78V5Z" clip-rule="evenodd" />
          </svg>
          <span>History</span>
        </div>
      </a>

      <!-- Stats / Status -->
      <a
        href="#/stats"
        onclick={(e) => {
          e.preventDefault();
          handleNavigate("/stats");
        }}
        class="flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors hover:bg-accent {router.current.name === 'stats' ? 'bg-primary/15 text-primary font-semibold' : 'text-foreground/90'}"
      >
        <div class="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 {router.current.name === 'stats' ? 'text-primary' : 'text-muted-foreground'}">
            <path d="M15.5 2A1.5 1.5 0 0 0 14 3.5v13a1.5 1.5 0 0 0 1.5 1.5h1a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 16.5 2h-1ZM9.5 6A1.5 1.5 0 0 0 8 7.5v9A1.5 1.5 0 0 0 9.5 18h1a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 10.5 6h-1ZM3.5 10A1.5 1.5 0 0 0 2 11.5v5A1.5 1.5 0 0 0 3.5 18h1A1.5 1.5 0 0 0 6 16.5v-5A1.5 1.5 0 0 0 4.5 10h-1Z" />
          </svg>
          <span>Status &amp; Stats</span>
        </div>
      </a>

      <div class="pt-2 pb-1">
        <div class="h-px bg-border/60"></div>
      </div>

      <!-- Settings -->
      <a
        href="#/settings"
        onclick={(e) => {
          e.preventDefault();
          handleNavigate("/settings");
        }}
        class="flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors hover:bg-accent {router.current.name === 'settings' ? 'bg-primary/15 text-primary font-semibold' : 'text-foreground/90'}"
      >
        <div class="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 {router.current.name === 'settings' ? 'text-primary' : 'text-muted-foreground'}">
            <path fill-rule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clip-rule="evenodd" />
          </svg>
          <span>Settings</span>
        </div>
      </a>
    </nav>

    <!-- Footer info -->
    <div class="border-t border-border/70 px-4 py-3 text-xs text-muted-foreground flex items-center justify-between">
      <span>Animedy</span>
      <span class="rounded bg-accent/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">Ad-free</span>
    </div>
  </div>
{/if}
