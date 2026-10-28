<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import AnimeDetail from "$lib/pages/AnimeDetail.svelte";
  import Home from "$lib/pages/Home.svelte";
  import History from "$lib/pages/History.svelte";
  import Placeholder from "$lib/pages/Placeholder.svelte";
  import Settings from "$lib/pages/Settings.svelte";
  import Watch from "$lib/pages/Watch.svelte";
  import { router } from "$lib/router.svelte";
  import { auth } from "$lib/stores/auth.svelte";

  let email = $state("");
  let password = $state("");
  let showLogin = $state(false);

  $effect(() => {
    void auth.restore();
  });

  async function onLoginSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const ok = await auth.login({ email, password });
    if (ok) {
      showLogin = false;
      password = "";
    }
  }
</script>

<div class="dark flex min-h-dvh flex-col bg-background text-foreground">
  <header class="flex items-center justify-between border-b border-border px-4 py-3">
    <a href="#/" class="text-lg font-semibold tracking-tight">
      <span class="text-primary">Ani</span>medy
    </a>
    <nav class="flex items-center gap-1 text-sm" aria-label="Main">
      <a href="#/history" class="rounded-md px-3 py-1.5 hover:bg-accent">History</a>
      <a href="#/settings" class="rounded-md px-3 py-1.5 hover:bg-accent">Settings</a>
      {#if auth.isLoggedIn}
        <span class="px-2 text-muted-foreground">Hi, {auth.user?.username}</span>
        <Button variant="outline" size="sm" onclick={() => auth.logout()}>Log out</Button>
      {:else}
        <Button size="sm" onclick={() => (showLogin = !showLogin)}>
          {showLogin ? "Close" : "Log in"}
        </Button>
      {/if}
    </nav>
  </header>

  <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
    {#if showLogin && !auth.isLoggedIn}
      <form class="mx-auto flex max-w-sm flex-col gap-3" onsubmit={onLoginSubmit}>
        <label class="flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            bind:value={email}
            required
            autocomplete="email"
            class="h-9 rounded-md border border-input bg-background px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm">
          Password
          <input
            type="password"
            bind:value={password}
            required
            autocomplete="current-password"
            class="h-9 rounded-md border border-input bg-background px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        {#if auth.error}
          <p class="text-sm text-destructive">{auth.error}</p>
        {/if}
        <Button type="submit" disabled={auth.loading}>
          {auth.loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    {:else if router.current.name === "home"}
      <Home />
    {:else if router.current.name === "anime"}
      <AnimeDetail animeId={router.current.animeId} />
    {:else if router.current.name === "watch"}
      <Watch animeId={router.current.animeId} episodeId={router.current.episodeId} />
    {:else if router.current.name === "history"}
      <History />
    {:else if router.current.name === "settings"}
      <Settings />
    {:else}
      <Placeholder title="Not found" task="a future task" />
    {/if}
  </main>
</div>
