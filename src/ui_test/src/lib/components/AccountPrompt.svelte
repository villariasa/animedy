<script lang="ts">
  // One-time "save your data" nudge for guests after the accounts update.
  // Dismiss persists forever; sign-up is always reachable from the menu.
  import { auth } from "$lib/stores/auth.svelte";
  import { router } from "$lib/router.svelte";

  const DISMISSED_KEY = "animedy.account_prompt_dismissed";

  let visible = $state(false);

  $effect(() => {
    if (auth.isLoggedIn) {
      visible = false;
      return;
    }
    try {
      visible = localStorage.getItem(DISMISSED_KEY) !== "1";
    } catch {
      visible = false;
    }
  });

  function dismiss(): void {
    visible = false;
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // storage disabled
    }
  }

  function signUp(): void {
    dismiss();
    router.go("/signup");
  }
</script>

{#if visible && router.current.name !== "watch" && router.current.name !== "signup" && router.current.name !== "signin"}
  <div class="fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-96">
    <div class="rounded-2xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur">
      <p class="text-sm font-medium">Keep your anime data everywhere</p>
      <p class="mt-1 text-xs text-muted-foreground">
        Create a free account to save your Liked, My List, watch statuses and settings — and use
        them on any device. Your current data on this device moves with you.
      </p>
      <div class="mt-3 flex gap-2">
        <button
          type="button"
          onclick={signUp}
          class="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
        >
          Sign up free
        </button>
        <button
          type="button"
          onclick={dismiss}
          class="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent"
        >
          Not now
        </button>
      </div>
    </div>
  </div>
{/if}
