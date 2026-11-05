<script lang="ts">
  import { router } from "$lib/router.svelte";
  import { auth } from "$lib/stores/auth.svelte";
  import { feedbackModal } from "$lib/stores/feedbackModal.svelte";

  let open = $state(false);
  let container: HTMLDivElement | undefined;

  const items = [
    {
      name: "history" as const,
      href: "#/history",
      label: "History",
      path: "M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .2.08.39.22.53l3 3a.75.75 0 0 0 1.06-1.06l-2.78-2.78V5Z"
    },
    {
      name: "stats" as const,
      href: "#/stats",
      label: "Stats",
      path: "M15.5 2A1.5 1.5 0 0 0 14 3.5v13a1.5 1.5 0 0 0 1.5 1.5h1a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 16.5 2h-1ZM9.5 6A1.5 1.5 0 0 0 8 7.5v9A1.5 1.5 0 0 0 9.5 18h1a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 10.5 6h-1ZM3.5 10A1.5 1.5 0 0 0 2 11.5v5A1.5 1.5 0 0 0 3.5 18h1A1.5 1.5 0 0 0 6 16.5v-5A1.5 1.5 0 0 0 4.5 10h-1Z"
    },
    {
      name: "settings" as const,
      href: "#/settings",
      label: "Settings",
      path: "M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
    }
  ];

  const isActive = $derived(items.some((i) => router.current.name === i.name));

  function toggleOpen(): void {
    open = !open;
  }

  function go(href: string): void {
    open = false;
    location.hash = href.slice(1);
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
    class="flex h-9 w-9 items-center justify-center rounded-xl transition-all hover:bg-accent active:scale-95 {open || isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-primary'}"
    title="More"
    aria-label="More options"
    aria-haspopup="menu"
    aria-expanded={open}
  >
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-5 w-5">
      <path d="M10 3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM10 8.5A1.5 1.5 0 1 1 10 11.5a1.5 1.5 0 0 1 0-3ZM10 14a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" />
    </svg>
  </button>

  {#if open}
    <div
      role="menu"
      class="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-xl border border-border/80 bg-popover text-popover-foreground shadow-2xl"
    >
      {#each items as item (item.name)}
        <a
          href={item.href}
          role="menuitem"
          onclick={(e) => {
            e.preventDefault();
            go(item.href);
          }}
          class="flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium transition-colors hover:bg-accent {router.current.name === item.name ? 'text-primary bg-primary/5' : ''}"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 shrink-0 {router.current.name === item.name ? 'text-primary' : 'text-muted-foreground'}">
            <path fill-rule="evenodd" d={item.path} clip-rule="evenodd" />
          </svg>
          {item.label}
        </a>
      {/each}

      <!-- Feedback (everyone, guests included) -->
      <button
        type="button"
        role="menuitem"
        onclick={() => {
          open = false;
          feedbackModal.open = true;
        }}
        class="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-medium transition-colors hover:bg-accent"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 shrink-0 text-muted-foreground">
          <path fill-rule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902.848.137 1.705.248 2.57.331v3.443a.75.75 0 0 0 1.28.53l3.58-3.579a.78.78 0 0 1 .527-.224 41.202 41.202 0 0 0 5.183-.5c1.437-.232 2.43-1.49 2.43-2.903V5.426c0-1.413-.993-2.67-2.43-2.902A41.289 41.289 0 0 0 10 2Zm0 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM6 8a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm7 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clip-rule="evenodd" />
        </svg>
        Feedback
      </button>

      <!-- Account section -->
      <div class="border-t border-border/70">
        {#if auth.isLoggedIn}
          <div class="px-3.5 py-2 text-xs text-muted-foreground">
            Signed in as <span class="font-medium text-foreground">{auth.user?.username}</span>
          </div>
          {#if auth.isAdmin}
            <a
              href="#/admin"
              role="menuitem"
              onclick={(e) => {
                e.preventDefault();
                go("#/admin");
              }}
              class="flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium transition-colors hover:bg-accent {router.current.name === 'admin' ? 'text-primary bg-primary/5' : ''}"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 shrink-0 text-muted-foreground">
                <path fill-rule="evenodd" d="M9.661 2.237a.531.531 0 0 1 .678 0 11.947 11.947 0 0 0 7.078 2.749.5.5 0 0 1 .479.425c.069.52.104 1.05.104 1.59 0 5.162-3.26 9.563-7.834 11.256a.48.48 0 0 1-.332 0C5.26 16.564 2 12.163 2 7c0-.538.035-1.069.104-1.589a.5.5 0 0 1 .48-.425 11.947 11.947 0 0 0 7.077-2.75Z" clip-rule="evenodd" />
              </svg>
              Admin
            </a>
          {/if}
          <button
            type="button"
            role="menuitem"
            onclick={() => {
              open = false;
              auth.logout();
            }}
            class="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 shrink-0">
              <path fill-rule="evenodd" d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z" clip-rule="evenodd" />
              <path fill-rule="evenodd" d="M19 10a.75.75 0 0 0-.75-.75H8.704l1.048-.943a.75.75 0 1 0-1.004-1.114l-2.5 2.25a.75.75 0 0 0 0 1.114l2.5 2.25a.75.75 0 1 0 1.004-1.114l-1.048-.943h9.546A.75.75 0 0 0 19 10Z" clip-rule="evenodd" />
            </svg>
            Sign out
          </button>
        {:else}
          <a
            href="#/signin"
            role="menuitem"
            onclick={(e) => {
              e.preventDefault();
              go("#/signin");
            }}
            class="flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium transition-colors hover:bg-accent {router.current.name === 'signin' ? 'text-primary bg-primary/5' : ''}"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 shrink-0 text-muted-foreground">
              <path fill-rule="evenodd" d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-7 9a7 7 0 1 1 14 0H3Z" clip-rule="evenodd" />
            </svg>
            Sign in
          </a>
          <a
            href="#/signup"
            role="menuitem"
            onclick={(e) => {
              e.preventDefault();
              go("#/signup");
            }}
            class="flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-accent {router.current.name === 'signup' ? 'bg-primary/5' : ''}"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 shrink-0">
              <path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003ZM16 8.75a.75.75 0 0 1 .75-.75h.75V7.25a.75.75 0 0 1 1.5 0V8h.75a.75.75 0 0 1 0 1.5H19v.75a.75.75 0 0 1-1.5 0v-.75h-.75a.75.75 0 0 1-.75-.75Z" />
            </svg>
            Sign up
          </a>
        {/if}
      </div>
    </div>
  {/if}
</div>
