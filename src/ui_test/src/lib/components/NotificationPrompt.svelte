<script lang="ts">
  import {
    notificationsSupported,
    notificationPermission,
    requestNotificationPermission
  } from "$lib/notifications";

  const DISMISS_KEY = "animedy.notif_prompt_dismissed_at";
  const RENAG_AFTER_MS = 24 * 60 * 60 * 1000;

  let visible = $state(false);
  let requesting = $state(false);

  function recentlyDismissed(): boolean {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (!raw) return false;
      return Date.now() - Number(raw) < RENAG_AFTER_MS;
    } catch {
      return false;
    }
  }

  // Only ever asks once per load, and only when permission hasn't been
  // decided yet (not if the user already granted or blocked it).
  $effect(() => {
    if (notificationsSupported() && notificationPermission() === "default" && !recentlyDismissed()) {
      visible = true;
    }
  });

  function dismiss(): void {
    visible = false;
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // storage quota or disabled
    }
  }

  async function allow(): Promise<void> {
    requesting = true;
    await requestNotificationPermission();
    requesting = false;
    visible = false;
  }
</script>

{#if visible}
  <div
    class="fixed top-[calc(env(safe-area-inset-top)+1rem)] left-1/2 z-[90] flex w-[min(92vw,26rem)] -translate-x-1/2 items-start gap-3 rounded-xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur"
    role="dialog"
    aria-label="Enable notifications"
  >
    <span class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
        <path d="M10 2a6 6 0 0 0-6 6c0 1.887-.454 3.665-1.257 5.234a.75.75 0 0 0 .515 1.076 32.91 32.91 0 0 0 3.256.508 3.5 3.5 0 0 0 6.972 0 32.903 32.903 0 0 0 3.256-.508.75.75 0 0 0 .515-1.076A11.448 11.448 0 0 1 16 8a6 6 0 0 0-6-6ZM8.05 14.943a33.54 33.54 0 0 0 3.9 0 2 2 0 0 1-3.9 0Z" />
      </svg>
    </span>
    <div class="min-w-0 flex-1">
      <p class="text-sm font-semibold">Get notified about new episodes?</p>
      <p class="mt-0.5 text-xs text-muted-foreground">
        We'll let you know when a show from your Liked or My List airs a new episode.
      </p>
      <div class="mt-3 flex items-center gap-2">
        <button
          type="button"
          class="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          onclick={allow}
          disabled={requesting}
        >
          {requesting ? "Requesting…" : "Allow"}
        </button>
        <button
          type="button"
          class="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          onclick={dismiss}
        >
          Not now
        </button>
      </div>
    </div>
    <button
      type="button"
      class="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
      onclick={dismiss}
      aria-label="Dismiss"
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-3.5 w-3.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
{/if}
