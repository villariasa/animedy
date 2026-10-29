<script lang="ts">
  import AnimeDetail from "$lib/pages/AnimeDetail.svelte";
  import Home from "$lib/pages/Home.svelte";
  import History from "$lib/pages/History.svelte";
  import Favorites from "$lib/pages/Favorites.svelte";
  import MyList from "$lib/pages/MyList.svelte";
  import HeaderSearch from "$lib/components/HeaderSearch.svelte";
  import { likes } from "$lib/stores/likes.svelte";
  import { watchStatusStore } from "$lib/stores/watchStatus.svelte";
  import Placeholder from "$lib/pages/Placeholder.svelte";
  import Settings from "$lib/pages/Settings.svelte";
  import Watch from "$lib/pages/Watch.svelte";
  import UndoSnackbar from "$lib/components/UndoSnackbar.svelte";
  import NewEpisodeNotifier from "$lib/components/NewEpisodeNotifier.svelte";
  import AmbientBackground from "$lib/components/AmbientBackground.svelte";
  import { router } from "$lib/router.svelte";
  import { homeReset } from "$lib/stores/homeReset.svelte";

  let isSearchActive = $state(false);

  function goHome(): void {
    router.go("/");
    homeReset.trigger();
  }
</script>

<div class="dark flex min-h-dvh flex-col bg-background text-foreground">
  <AmbientBackground />
  <header class="sticky top-0 z-40 flex items-center justify-between gap-2 sm:gap-4 border-b border-border/80 bg-background/95 px-3 sm:px-6 py-2.5 backdrop-blur-md">
    <!-- Logo & Home icon (hidden on mobile when search is actively expanded) -->
    <div class="items-center gap-1.5 sm:gap-2 shrink-0 {isSearchActive ? 'hidden sm:flex' : 'flex'}">
      <a
        href="#/"
        onclick={(e) => { e.preventDefault(); goHome(); }}
        class="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl text-muted-foreground transition-all hover:bg-accent hover:text-primary active:scale-95 {router.current.name === 'home' ? 'bg-primary/10 text-primary' : ''}"
        title="Home"
        aria-label="Home"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 sm:h-5 sm:w-5">
          <path fill-rule="evenodd" d="M9.293 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 17 11h-1v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6H3a1 1 0 0 1-.707-1.707l7-7Z" clip-rule="evenodd" />
        </svg>
      </a>
      <a
        href="#/"
        onclick={(e) => { e.preventDefault(); goHome(); }}
        class="transition-opacity hover:opacity-90 flex items-center"
      >
        <img src="/icons/logo-small.png" alt="Animedy" class="h-7 w-auto sm:h-8" />
      </a>
    </div>

    <!-- Header Search with instant suggest dropdown -->
    <div class="flex-1 max-w-md mx-1 sm:mx-6 min-w-0 {isSearchActive ? 'max-w-none mx-0' : ''}">
      <HeaderSearch bind:isSearchActive />
    </div>

    <!-- Main Navigation (hidden on mobile when search is actively expanded) -->
    <nav class="items-center gap-0.5 sm:gap-1 text-sm shrink-0 {isSearchActive ? 'hidden sm:flex' : 'flex'}" aria-label="Main">
      <a
        href="#/favorites"
        class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors hover:bg-accent {router.current.name === 'favorites' ? 'bg-primary/10 text-primary font-medium' : ''}"
        title="Liked anime"
        aria-label="Liked anime"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 text-rose-500 shrink-0">
          <path d="m9.653 16.915-.005-.003-.019-.01a20.759 20.759 0 0 1-1.16-1.107 20.373 20.373 0 0 1-3.69-4.836A7.472 7.472 0 0 1 4 7.5C4 4.462 6.462 2 9.5 2a5.498 5.498 0 0 1 4.298 2.043A5.498 5.498 0 0 1 18.5 7.5c0 1.258-.337 2.44-.925 3.46a20.373 20.373 0 0 1-3.69 4.836 20.758 20.758 0 0 1-1.16 1.107l-.02.01-.005.003h-.002a.75.75 0 0 1-.698 0l-.002-.003Z" />
        </svg>
        <span class="hidden sm:inline">Liked</span>
        {#if likes.count > 0}
          <span class="rounded-full bg-rose-500/20 px-1.5 py-0.2 text-[10px] font-bold text-rose-400">
            {likes.count}
          </span>
        {/if}
      </a>

      <a
        href="#/mylist"
        class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors hover:bg-accent {router.current.name === 'mylist' ? 'bg-primary/10 text-primary font-medium' : ''}"
        title="My List"
        aria-label="My List"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 text-primary shrink-0">
          <path fill-rule="evenodd" d="M4 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v14l-6-3-6 3V4Z" clip-rule="evenodd" />
        </svg>
        <span class="hidden sm:inline">My List</span>
        {#if watchStatusStore.count > 0}
          <span class="rounded-full bg-primary/20 px-1.5 py-0.2 text-[10px] font-bold text-primary">
            {watchStatusStore.count}
          </span>
        {/if}
      </a>

      <a
        href="#/history"
        class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors hover:bg-accent {router.current.name === 'history' ? 'bg-primary/10 text-primary font-medium' : ''}"
        title="Watch history"
        aria-label="Watch history"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 opacity-75 shrink-0">
          <path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .2.08.39.22.53l3 3a.75.75 0 0 0 1.06-1.06l-2.78-2.78V5Z" clip-rule="evenodd" />
        </svg>
        <span class="hidden sm:inline">History</span>
      </a>

      <a
        href="#/settings"
        class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors hover:bg-accent {router.current.name === 'settings' ? 'bg-primary/10 text-primary font-medium' : ''}"
        title="Settings"
        aria-label="Settings"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 opacity-75 shrink-0">
          <path fill-rule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clip-rule="evenodd" />
        </svg>
        <span class="hidden sm:inline">Settings</span>
      </a>
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
    {:else if router.current.name === "mylist"}
      <MyList />
    {:else if router.current.name === "history"}
      <History />
    {:else if router.current.name === "settings"}
      <Settings />
    {:else}
      <Placeholder title="Not found" task="a future task" />
    {/if}
  </main>

  <UndoSnackbar />
  <NewEpisodeNotifier />
</div>
