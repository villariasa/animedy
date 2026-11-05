<script lang="ts">
  // Admin-approved password reset. Three stages on one page:
  //   request → waiting for admin approval (auto-polls) → set new password.
  // The device that requested is the only one that can finish the reset
  // (a secret stored in localStorage is checked server-side), so come back
  // to this page in the SAME browser after the admin approves.
  import { router } from "$lib/router.svelte";
  import {
    apiForgotRequest,
    apiForgotStatus,
    apiForgotReset,
    clearResetSecret,
    passwordProblems,
    passwordStrength
  } from "$lib/api/account";
  import TurnstileWidget from "$lib/components/TurnstileWidget.svelte";

  let identifier = $state("");
  let turnstileToken = $state("");
  let turnstileWidget: TurnstileWidget | undefined;
  let stage = $state<"request" | "waiting" | "reset" | "done">("request");
  let statusNote = $state("");
  let errorMessage = $state("");
  let busy = $state(false);

  let newPassword = $state("");
  let confirm = $state("");
  const passwordProblem = $derived(newPassword ? passwordProblems(newPassword) : null);
  const strength = $derived(passwordStrength(newPassword));
  const confirmMismatch = $derived(confirm.length > 0 && confirm !== newPassword);

  const STRENGTH_LABELS = ["", "Weak", "Okay", "Good", "Strong"];
  const STRENGTH_COLORS = ["", "bg-red-500", "bg-amber-500", "bg-lime-500", "bg-emerald-500"];

  async function submitRequest(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    if (busy || !identifier.trim()) return;
    busy = true;
    errorMessage = "";
    try {
      await apiForgotRequest(identifier.trim(), turnstileToken);
      stage = "waiting";
      statusNote = "Request sent. Waiting for the admin to approve it…";
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : "Request failed";
      turnstileWidget?.reset();
    } finally {
      busy = false;
    }
  }

  async function checkStatus(): Promise<void> {
    if (!identifier.trim()) return;
    try {
      const { status } = await apiForgotStatus(identifier.trim());
      if (status === "approved") {
        stage = "reset";
        statusNote = "";
      } else if (status === "denied") {
        statusNote = "The admin denied this request.";
      } else if (status === "expired") {
        statusNote = "The approval expired (24h) — send a new request.";
        stage = "request";
      } else if (status === "pending") {
        statusNote = "Still waiting for the admin to approve…";
      } else {
        statusNote = "No request found from this device — send one below.";
        stage = "request";
      }
    } catch {
      // network hiccup — next poll retries
    }
  }

  // Poll every 10s while waiting (only when the tab is visible).
  $effect(() => {
    if (stage !== "waiting") return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void checkStatus();
    }, 10_000);
    return () => clearInterval(timer);
  });

  async function submitReset(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    if (busy || passwordProblem || confirm !== newPassword) return;
    busy = true;
    errorMessage = "";
    try {
      await apiForgotReset(identifier.trim(), newPassword);
      clearResetSecret();
      stage = "done";
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : "Reset failed";
    } finally {
      busy = false;
    }
  }
</script>

<main class="mx-auto w-full max-w-md px-4 py-10">
  <div class="rounded-2xl border border-border/80 bg-card/80 p-6 shadow-lg backdrop-blur">
    <h1 class="text-xl font-semibold">Forgot password</h1>

    {#if stage === "request"}
      <p class="mt-1 text-sm text-muted-foreground">
        Send a reset request — the site admin approves it, then you set a new password
        <span class="font-medium text-foreground">in this same browser</span>.
      </p>
      <form class="mt-6 flex flex-col gap-4" onsubmit={submitRequest}>
        <label class="flex flex-col gap-1.5 text-sm">
          <span class="text-muted-foreground">Email or username</span>
          <input
            type="text"
            bind:value={identifier}
            required
            autocomplete="username"
            class="rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-primary"
            placeholder="you@example.com"
          />
        </label>
        <TurnstileWidget bind:this={turnstileWidget} bind:token={turnstileToken} />
        {#if statusNote}
          <p class="text-xs text-amber-400">{statusNote}</p>
        {/if}
        {#if errorMessage}
          <p class="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{errorMessage}</p>
        {/if}
        <button
          type="submit"
          disabled={busy || !identifier.trim()}
          class="rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-50"
        >
          {busy ? "Sending…" : "Request password reset"}
        </button>
      </form>

    {:else if stage === "waiting"}
      <div class="mt-6 flex flex-col items-center gap-4 py-6 text-center">
        <span class="relative flex h-10 w-10">
          <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/40"></span>
          <span class="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">⏳</span>
        </span>
        <p class="text-sm text-muted-foreground">{statusNote}</p>
        <p class="text-xs text-muted-foreground">This page checks automatically every 10 seconds.</p>
        <button
          type="button"
          onclick={() => void checkStatus()}
          class="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Check now
        </button>
      </div>

    {:else if stage === "reset"}
      <p class="mt-1 text-sm text-emerald-400">Approved! Set your new password.</p>
      <form class="mt-6 flex flex-col gap-4" onsubmit={submitReset}>
        <label class="flex flex-col gap-1.5 text-sm">
          <span class="text-muted-foreground">New password</span>
          <input
            type="password"
            bind:value={newPassword}
            required
            autocomplete="new-password"
            class="rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-primary"
            placeholder="10+ chars with upper, lower, digit, symbol"
          />
          {#if newPassword}
            <div class="mt-1 flex items-center gap-2">
              <div class="flex h-1.5 flex-1 gap-1 overflow-hidden rounded-full">
                {#each [1, 2, 3, 4] as step (step)}
                  <div class="h-full flex-1 rounded-full {strength >= step ? STRENGTH_COLORS[strength] : 'bg-border'}"></div>
                {/each}
              </div>
              <span class="w-14 text-right text-xs text-muted-foreground">{STRENGTH_LABELS[strength]}</span>
            </div>
            {#if passwordProblem}
              <span class="text-xs text-amber-400">{passwordProblem}</span>
            {/if}
          {/if}
        </label>
        <label class="flex flex-col gap-1.5 text-sm">
          <span class="text-muted-foreground">Confirm new password</span>
          <input
            type="password"
            bind:value={confirm}
            required
            autocomplete="new-password"
            class="rounded-lg border bg-background px-3 py-2 outline-none focus:border-primary {confirmMismatch ? 'border-red-500' : 'border-border'}"
          />
          {#if confirmMismatch}
            <span class="text-xs text-red-400">Passwords don't match</span>
          {/if}
        </label>
        {#if errorMessage}
          <p class="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{errorMessage}</p>
        {/if}
        <button
          type="submit"
          disabled={busy || !newPassword || !!passwordProblem || confirm !== newPassword}
          class="rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-50"
        >
          {busy ? "Saving…" : "Change password"}
        </button>
      </form>

    {:else}
      <div class="mt-6 flex flex-col items-center gap-4 py-6 text-center">
        <span class="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">✓</span>
        <p class="text-sm">Password changed — you can sign in now.</p>
        <button
          type="button"
          onclick={() => router.go("/signin")}
          class="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:opacity-90 active:scale-[0.99]"
        >
          Go to sign in
        </button>
      </div>
    {/if}

    {#if stage === "request" || stage === "waiting"}
      <p class="mt-4 text-center text-sm text-muted-foreground">
        Remembered it?
        <a href="#/signin" class="text-primary hover:underline">Sign in</a>
      </p>
    {/if}
  </div>
</main>
