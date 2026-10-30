<script lang="ts">
  import { router } from "$lib/router.svelte";

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
    </div>
  {/if}
</div>
