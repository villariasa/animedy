<script lang="ts">
  import AnimeDetail from "$lib/pages/AnimeDetail.svelte";
  import Home from "$lib/pages/Home.svelte";
  import History from "$lib/pages/History.svelte";
  import Favorites from "$lib/pages/Favorites.svelte";
  import HeaderSearch from "$lib/components/HeaderSearch.svelte";
  import { likes } from "$lib/stores/likes.svelte";
  import Placeholder from "$lib/pages/Placeholder.svelte";
  import Settings from "$lib/pages/Settings.svelte";
  import Watch from "$lib/pages/Watch.svelte";
  import { router } from "$lib/router.svelte";
</script>

<div class="dark flex min-h-dvh flex-col bg-background text-foreground">
  <header class="sticky top-0 z-40 flex items-center justify-between gap-4 border-b border-border/80 bg-background/95 px-4 py-2.5 backdrop-blur-md">
    <div class="flex items-center gap-4 shrink-0">
      <a href="#/" class="text-lg font-bold tracking-tight text-foreground transition-opacity hover:opacity-90">
        <span class="text-primary">Ani</span>medy
      </a>
    </div>

    <!-- Header Search with instant suggest dropdown -->
    <div class="flex-1 max-w-md mx-2 sm:mx-6">
      <HeaderSearch />
    </div>

    <nav class="flex items-center gap-1 text-sm shrink-0" aria-label="Main">
      <a href="#/favorites" class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors hover:bg-accent {router.current.name === 'favorites' ? 'bg-primary/10 text-primary font-medium' : ''}">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 text-rose-500">
          <path d="m9.653 16.915-.005-.003-.019-.01a20.759 20.759 0 0 1-1.16-1.107 20.373 20.373 0 0 1-3.69-4.836A7.472 7.472 0 0 1 4 7.5C4 4.462 6.462 2 9.5 2a5.498 5.498 0 0 1 4.298 2.043A5.498 5.498 0 0 1 18.5 7.5c0 1.258-.337 2.44-.925 3.46a20.373 20.373 0 0 1-3.69 4.836 20.758 20.758 0 0 1-1.16 1.107l-.02.01-.005.003h-.002a.75.75 0 0 1-.698 0l-.002-.003Z" />
        </svg>
        Liked
        {#if likes.count > 0}
          <span class="rounded-full bg-rose-500/20 px-1.5 py-0.2 text-[10px] font-bold text-rose-400">
            {likes.count}
          </span>
        {/if}
      </a>
      <a href="#/history" class="rounded-md px-3 py-1.5 transition-colors hover:bg-accent {router.current.name === 'history' ? 'bg-primary/10 text-primary font-medium' : ''}">History</a>
      <a href="#/settings" class="rounded-md px-3 py-1.5 transition-colors hover:bg-accent {router.current.name === 'settings' ? 'bg-primary/10 text-primary font-medium' : ''}">Settings</a>
    </nav>
  </header>

  <main class="mx-auto w-full max-w-[1480px] flex-1 px-4 sm:px-6 py-8">
    {#if router.current.name === "home"}
      <Home />
    {:else if router.current.name === "anime"}
      <AnimeDetail animeId={router.current.animeId} />
    {:else if router.current.name === "watch"}
      <Watch animeId={router.current.animeId} episodeId={router.current.episodeId} />
    {:else if router.current.name === "favorites"}
      <Favorites />
    {:else if router.current.name === "history"}
      <History />
    {:else if router.current.name === "settings"}
      <Settings />
    {:else}
      <Placeholder title="Not found" task="a future task" />
    {/if}
  </main>
</div>
