<script lang="ts">
  // Full-page verification interstitial (PLAN_VERIFY_GATE.md).
  //   daily: shown once per device per 24h before browsing.
  //   auth:  shown before every sign-in / sign-up / forgot attempt
  //          (single-use pass — each attempt needs a fresh one).
  // Renders INSTEAD of the app shell (no header/nav) — see App.svelte.
  import { router } from "$lib/router.svelte";
  import {
    apiVerify,
    storeDailyPass,
    storeAuthPass,
    TURNSTILE_SITE_KEY
  } from "$lib/api/account";
  import TurnstileWidget from "$lib/components/TurnstileWidget.svelte";

  let { purpose, then: thenPath }: { purpose: "daily" | "auth"; then: string } = $props();

  let token = $state("");
  let submitting = $state(false);
  let errorMessage = $state("");
  let turnstileWidget: TurnstileWidget | undefined;

  const offline = $state(typeof navigator !== "undefined" && !navigator.onLine);

  async function exchange(turnstileToken: string): Promise<void> {
    if (submitting) return;
    submitting = true;
    errorMessage = "";
    try {
      const result = await apiVerify(turnstileToken, purpose);
      if (purpose === "auth") {
        storeAuthPass(result.pass, result.expires_at);
        if (result.daily_pass && result.daily_expires_at) {
          storeDailyPass(result.daily_pass, result.daily_expires_at);
        }
      } else {
        storeDailyPass(result.pass, result.expires_at);
      }
      router.go(thenPath);
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : "Verification failed — try again";
      turnstileWidget?.reset();
    } finally {
      submitting = false;
    }
  }

  // Auto-submit the moment the widget solves.
  $effect(() => {
    if (token) void exchange(token);
  });

  // No site key configured (dev / pre-setup): the server issues passes
  // without a challenge — exchange immediately so nothing blocks.
  $effect(() => {
    if (!TURNSTILE_SITE_KEY && !offline) void exchange("");
  });

  function skipOffline(): void {
    // Verification is impossible offline; never brick the cached PWA.
    router.go(thenPath);
  }
</script>

<main class="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4 text-center">
  <img src="/icons/logo-small.png" alt="Animedy" class="h-10 w-auto" />

  <div class="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-border/80 bg-card/70 p-8 shadow-xl backdrop-blur">
    <h1 class="text-lg font-semibold">Quick security check</h1>
    <p class="text-sm text-muted-foreground">
      {purpose === "auth"
        ? "Confirm you're human to continue signing in."
        : "One quick check and you're in for the day."}
    </p>

    {#if offline}
      <p class="text-xs text-amber-400">You appear to be offline — verification is skipped.</p>
      <button
        type="button"
        onclick={skipOffline}
        class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:opacity-90 active:scale-95"
      >
        Continue offline
      </button>
    {:else}
      <TurnstileWidget bind:this={turnstileWidget} bind:token />
      {#if submitting}
        <p class="text-xs text-muted-foreground">Verifying…</p>
      {/if}
      {#if errorMessage}
        <p class="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {errorMessage}
        </p>
      {/if}
    {/if}
  </div>

  <p class="text-[11px] text-muted-foreground/70">Protected by Cloudflare Turnstile</p>
</main>
