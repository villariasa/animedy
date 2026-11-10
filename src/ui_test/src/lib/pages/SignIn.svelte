<script lang="ts">
  import { auth } from "$lib/stores/auth.svelte";
  import { router } from "$lib/router.svelte";
  import { hasValidAuthPass } from "$lib/api/account";
  import { ApiError } from "$lib/api/client";
  import Icon from "$lib/components/Icon.svelte";

  let identifier = $state("");
  let password = $state("");
  let showPassword = $state(false);
  let submitting = $state(false);
  let errorMessage = $state("");

  // Every attempt needs a fresh single-use verification pass — arriving
  // without one detours through the full-page #/verify check first.
  function goVerify(): void {
    router.go("/verify?purpose=auth&then=" + encodeURIComponent("/signin"));
  }
  $effect(() => {
    if (!hasValidAuthPass()) goVerify();
  });

  async function submit(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    if (submitting || !identifier || !password) return;
    submitting = true;
    errorMessage = "";
    try {
      await auth.login({ email: identifier, password });
      router.go("/");
    } catch (err) {
      if (err instanceof ApiError && err.httpCode === 428) {
        goVerify();
        return;
      }
      errorMessage = err instanceof Error ? err.message : "Sign in failed";
    } finally {
      submitting = false;
    }
  }
</script>

<main class="mx-auto w-full max-w-md px-4 py-10">
  <div class="rounded-2xl border border-border/80 bg-card/80 p-6 shadow-lg backdrop-blur">
    <h1 class="text-xl font-semibold">Welcome back</h1>
    <p class="mt-1 text-sm text-muted-foreground">
      Sign in to sync your Liked, My List and progress across devices.
    </p>

    <form class="mt-6 flex flex-col gap-4" onsubmit={submit}>
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

      <label class="flex flex-col gap-1.5 text-sm">
        <span class="text-muted-foreground">Password</span>
        <div class="relative flex items-center">
          <input
            type={showPassword ? "text" : "password"}
            bind:value={password}
            required
            autocomplete="current-password"
            class="w-full rounded-lg border border-border bg-background px-3 py-2 pr-10 outline-none focus:border-primary"
          />
          <button
            type="button"
            onclick={() => (showPassword = !showPassword)}
            class="absolute right-2.5 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
            aria-label={showPassword ? "Hide password" : "Show password"}
            title={showPassword ? "Hide password" : "Show password"}
          >
            <Icon name={showPassword ? "eye-slash" : "eye"} class="h-4.5 w-4.5" />
          </button>
        </div>
      </label>

      {#if errorMessage}
        <p class="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {errorMessage}
        </p>
      {/if}

      <button
        type="submit"
        disabled={submitting}
        class="rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground transition-all hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? (auth.syncing ? "Syncing your data…" : "Signing in…") : "Sign in"}
      </button>
    </form>

    <p class="mt-4 text-center text-sm text-muted-foreground">
      New here?
      <a href="#/signup" class="text-primary hover:underline">Create an account</a>
    </p>
    <p class="mt-1.5 text-center text-sm">
      <a href="#/forgot" class="text-muted-foreground hover:text-primary hover:underline">Forgot password?</a>
    </p>
  </div>
</main>
