<script lang="ts">
  import { auth } from "$lib/stores/auth.svelte";
  import { router } from "$lib/router.svelte";
  import { passwordProblems, passwordStrength, USERNAME_RE, hasValidAuthPass } from "$lib/api/account";
  import { ApiError } from "$lib/api/client";
  import Icon from "$lib/components/Icon.svelte";

  let email = $state("");
  let username = $state("");
  let password = $state("");
  let confirm = $state("");
  let showPassword = $state(false);
  let showConfirm = $state(false);
  let submitting = $state(false);
  let errorMessage = $state("");
  let usernameStatus = $state<"idle" | "checking" | "available" | "taken">("idle");
  let checkTimer: ReturnType<typeof setTimeout> | undefined;

  // Sign-up needs a fresh single-use verification pass, same as sign-in.
  function goVerify(): void {
    router.go("/verify?purpose=auth&then=" + encodeURIComponent("/signup"));
  }
  $effect(() => {
    if (!hasValidAuthPass()) goVerify();
  });

  const usernameValid = $derived(USERNAME_RE.test(username));
  const passwordProblem = $derived(password ? passwordProblems(password) : null);
  const strength = $derived(passwordStrength(password));
  const confirmMismatch = $derived(confirm.length > 0 && confirm !== password);
  const canSubmit = $derived(
    !submitting &&
      email.includes("@") &&
      usernameValid &&
      usernameStatus !== "taken" &&
      password.length > 0 &&
      !passwordProblem &&
      confirm === password
  );

  const STRENGTH_LABELS = ["", "Weak", "Okay", "Good", "Strong"];
  const STRENGTH_COLORS = ["", "bg-red-500", "bg-amber-500", "bg-lime-500", "bg-emerald-500"];

  function onUsernameInput(): void {
    usernameStatus = "idle";
    clearTimeout(checkTimer);
    if (!usernameValid) return;
    usernameStatus = "checking";
    checkTimer = setTimeout(async () => {
      try {
        const { available } = await auth.checkUsername(username);
        usernameStatus = available ? "available" : "taken";
      } catch {
        usernameStatus = "idle";
      }
    }, 400);
  }

  async function submit(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    if (!canSubmit) return;
    submitting = true;
    errorMessage = "";
    try {
      await auth.register({ email, username, password });
      router.go("/");
    } catch (err) {
      if (err instanceof ApiError && err.httpCode === 428) {
        goVerify();
        return;
      }
      errorMessage = err instanceof Error ? err.message : "Sign up failed";
    } finally {
      submitting = false;
    }
  }
</script>

<main class="mx-auto w-full max-w-md px-4 py-10">
  <div class="rounded-2xl border border-border/80 bg-card/80 p-6 shadow-lg backdrop-blur">
    <h1 class="text-xl font-semibold">Create your account</h1>
    <p class="mt-1 text-sm text-muted-foreground">
      Keep your Liked, My List and progress on every device.
    </p>

    <form class="mt-6 flex flex-col gap-4" onsubmit={submit}>
      <label class="flex flex-col gap-1.5 text-sm">
        <span class="text-muted-foreground">Email</span>
        <input
          type="email"
          bind:value={email}
          required
          autocomplete="email"
          class="rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-primary"
          placeholder="you@example.com"
        />
      </label>

      <label class="flex flex-col gap-1.5 text-sm">
        <span class="text-muted-foreground">Username</span>
        <input
          type="text"
          bind:value={username}
          oninput={onUsernameInput}
          required
          autocomplete="username"
          class="rounded-lg border bg-background px-3 py-2 outline-none focus:border-primary {usernameStatus === 'taken' ? 'border-red-500' : 'border-border'}"
          placeholder="3-20 letters, numbers, underscore"
        />
        {#if username && !usernameValid}
          <span class="text-xs text-red-400">3–20 characters: letters, numbers, underscore only</span>
        {:else if usernameStatus === "checking"}
          <span class="text-xs text-muted-foreground">Checking availability…</span>
        {:else if usernameStatus === "available"}
          <span class="text-xs text-emerald-400">Username is available</span>
        {:else if usernameStatus === "taken"}
          <span class="text-xs text-red-400">Username is already taken</span>
        {/if}
      </label>

      <label class="flex flex-col gap-1.5 text-sm">
        <span class="text-muted-foreground">Password</span>
        <div class="relative flex items-center">
          <input
            type={showPassword ? "text" : "password"}
            bind:value={password}
            required
            autocomplete="new-password"
            class="w-full rounded-lg border border-border bg-background px-3 py-2 pr-10 outline-none focus:border-primary"
            placeholder="10+ chars with upper, lower, digit, symbol"
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
        {#if password}
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
        <span class="text-muted-foreground">Confirm password</span>
        <div class="relative flex items-center">
          <input
            type={showConfirm ? "text" : "password"}
            bind:value={confirm}
            required
            autocomplete="new-password"
            class="w-full rounded-lg border bg-background px-3 py-2 pr-10 outline-none focus:border-primary {confirmMismatch ? 'border-red-500' : 'border-border'}"
          />
          <button
            type="button"
            onclick={() => (showConfirm = !showConfirm)}
            class="absolute right-2.5 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
            aria-label={showConfirm ? "Hide password" : "Show password"}
            title={showConfirm ? "Hide password" : "Show password"}
          >
            <Icon name={showConfirm ? "eye-slash" : "eye"} class="h-4.5 w-4.5" />
          </button>
        </div>
        {#if confirmMismatch}
          <span class="text-xs text-red-400">Passwords don't match</span>
        {/if}
      </label>

      {#if errorMessage}
        <p class="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {errorMessage}
        </p>
      {/if}

      <button
        type="submit"
        disabled={!canSubmit}
        class="rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground transition-all hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? (auth.syncing ? "Syncing your data…" : "Creating account…") : "Sign up"}
      </button>
    </form>

    <p class="mt-4 text-center text-sm text-muted-foreground">
      Already have an account?
      <a href="#/signin" class="text-primary hover:underline">Sign in</a>
    </p>
  </div>
</main>
