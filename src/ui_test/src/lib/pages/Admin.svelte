<script lang="ts">
  // Admin dashboard — live sessions (guests + accounts) and per-user stats.
  // Gated on role=admin client-side; the API enforces it server-side too.
  import { auth } from "$lib/stores/auth.svelte";
  import {
    apiAdminActivity,
    apiAdminUsers,
    apiAdminResetRequests,
    apiAdminResolveReset,
    type AdminSession,
    type AdminUser,
    type PasswordResetRequest
  } from "$lib/api/account";

  import { pushSupported, currentPushSubscription, enableAdminPush, disableAdminPush } from "$lib/push";

  let sessions = $state<AdminSession[]>([]);
  let users = $state<AdminUser[]>([]);
  let resetRequests = $state<PasswordResetRequest[]>([]);

  // Push alerts (works even when the PWA is closed)
  let pushEnabled = $state(false);
  let pushBusy = $state(false);
  let pushNote = $state("");

  $effect(() => {
    if (!auth.isAdmin) return;
    void currentPushSubscription().then((sub) => (pushEnabled = sub !== null));
  });

  async function togglePush(): Promise<void> {
    pushBusy = true;
    pushNote = "";
    try {
      if (pushEnabled) {
        await disableAdminPush();
        pushEnabled = false;
      } else {
        const problem = await enableAdminPush();
        if (problem) {
          pushNote = problem;
        } else {
          pushEnabled = true;
          pushNote = "This device now gets alerts even when the app is closed.";
        }
      }
    } finally {
      pushBusy = false;
    }
  }

  async function resolveReset(id: number, action: "approve" | "deny"): Promise<void> {
    try {
      await apiAdminResolveReset(id, action);
      resetRequests = resetRequests.map((r) =>
        r.id === id ? { ...r, status: action === "approve" ? "approved" : "denied" } : r
      );
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : "Action failed";
    }
  }
  let loading = $state(true);
  let errorMessage = $state("");

  const onlineSessions = $derived(sessions.filter((s) => s.online === 1));
  const watchingSessions = $derived(onlineSessions.filter((s) => s.anime_id !== null));

  async function refresh(): Promise<void> {
    errorMessage = "";
    try {
      const [activity, usersRes, resets] = await Promise.all([
        apiAdminActivity(),
        apiAdminUsers(),
        apiAdminResetRequests()
      ]);
      sessions = activity.sessions;
      users = usersRes.users;
      resetRequests = resets.requests;
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : "Failed to load admin data";
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (!auth.isAdmin) return;
    void refresh();
    const timer = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(timer);
  });

  function relTime(iso: string | null): string {
    if (!iso) return "never";
    const then = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z").getTime();
    const mins = Math.max(0, Math.round((Date.now() - then) / 60_000));
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
  }

  function fmtPos(seconds: number | null): string {
    if (seconds === null) return "";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
</script>

<main class="mx-auto w-full max-w-5xl px-4 py-8">
  {#if !auth.isAdmin}
    <div class="rounded-2xl border border-border bg-card/80 p-8 text-center">
      <p class="text-lg font-medium">Admins only</p>
      <p class="mt-1 text-sm text-muted-foreground">
        {auth.isLoggedIn ? "Your account doesn't have admin access." : "Sign in with an admin account to view this page."}
      </p>
    </div>
  {:else}
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">Admin — live activity</h1>
      <div class="flex items-center gap-2">
        {#if pushSupported()}
          <button
            type="button"
            disabled={pushBusy}
            onclick={() => void togglePush()}
            class="rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:opacity-50 {pushEnabled ? 'border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10' : 'border-border text-muted-foreground hover:bg-accent'}"
            title="Push alerts for reset requests — works even when the app is closed"
          >
            {pushBusy ? "…" : pushEnabled ? "🔔 Alerts on" : "🔕 Enable alerts"}
          </button>
        {/if}
        <button
          type="button"
          onclick={() => void refresh()}
          class="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent"
        >
          Refresh
        </button>
      </div>
    </div>
    {#if pushNote}
      <p class="mt-2 text-xs text-muted-foreground">{pushNote}</p>
    {/if}

    {#if errorMessage}
      <p class="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
        {errorMessage}
      </p>
    {/if}

    <!-- Summary tiles -->
    <div class="mt-4 grid grid-cols-3 gap-3">
      <div class="rounded-xl border border-border bg-card/80 p-4">
        <p class="text-2xl font-semibold text-emerald-400">{onlineSessions.length}</p>
        <p class="text-xs text-muted-foreground">Online now</p>
      </div>
      <div class="rounded-xl border border-border bg-card/80 p-4">
        <p class="text-2xl font-semibold text-primary">{watchingSessions.length}</p>
        <p class="text-xs text-muted-foreground">Watching now</p>
      </div>
      <div class="rounded-xl border border-border bg-card/80 p-4">
        <p class="text-2xl font-semibold">{users.length}</p>
        <p class="text-xs text-muted-foreground">Registered users</p>
      </div>
    </div>

    <!-- Live sessions -->
    <h2 class="mt-8 text-sm font-medium text-muted-foreground">Sessions (guests included)</h2>
    <div class="mt-2 overflow-x-auto rounded-xl border border-border">
      <table class="w-full min-w-[640px] text-sm">
        <thead class="bg-card/80 text-left text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2">Who</th>
            <th class="px-3 py-2">Status</th>
            <th class="px-3 py-2">Doing</th>
            <th class="px-3 py-2">Watching</th>
            <th class="px-3 py-2">Last seen</th>
          </tr>
        </thead>
        <tbody>
          {#if loading}
            <tr><td colspan="5" class="px-3 py-6 text-center text-muted-foreground">Loading…</td></tr>
          {:else if sessions.length === 0}
            <tr><td colspan="5" class="px-3 py-6 text-center text-muted-foreground">No sessions yet</td></tr>
          {:else}
            {#each sessions as s (s.client_id)}
              <tr class="border-t border-border/60">
                <td class="px-3 py-2">
                  {#if s.username}
                    <span class="font-medium">{s.username}</span>
                  {:else}
                    <span class="text-muted-foreground">Guest · {s.client_id.slice(0, 6)}</span>
                  {/if}
                </td>
                <td class="px-3 py-2">
                  {#if s.online === 1}
                    <span class="inline-flex items-center gap-1.5 text-emerald-400">
                      <span class="h-2 w-2 rounded-full bg-emerald-400"></span> Online
                    </span>
                  {:else}
                    <span class="text-muted-foreground">Offline</span>
                  {/if}
                </td>
                <td class="px-3 py-2 capitalize text-muted-foreground">{s.page ?? "—"}</td>
                <td class="px-3 py-2">
                  {#if s.anime_id !== null}
                    <span class="font-medium">{s.title ?? `Anime #${s.anime_id}`}</span>
                    {#if s.episode_number !== null}
                      <span class="text-muted-foreground"> · EP {s.episode_number}</span>
                    {/if}
                    {#if s.position_seconds !== null}
                      <span class="text-muted-foreground"> · {fmtPos(s.position_seconds)}</span>
                    {/if}
                  {:else}
                    <span class="text-muted-foreground">—</span>
                  {/if}
                </td>
                <td class="px-3 py-2 text-muted-foreground">{relTime(s.updated_at)}</td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    <!-- Password reset requests -->
    {#if resetRequests.length > 0}
      <h2 class="mt-8 text-sm font-medium text-muted-foreground">
        Password reset requests
        {#if resetRequests.some((r) => r.status === "pending")}
          <span class="ml-1.5 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-400">
            {resetRequests.filter((r) => r.status === "pending").length} pending
          </span>
        {/if}
      </h2>
      <div class="mt-2 overflow-x-auto rounded-xl border border-border">
        <table class="w-full min-w-[560px] text-sm">
          <thead class="bg-card/80 text-left text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2">User</th>
              <th class="px-3 py-2">Requested</th>
              <th class="px-3 py-2">Status</th>
              <th class="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {#each resetRequests as req (req.id)}
              <tr class="border-t border-border/60">
                <td class="px-3 py-2">
                  <span class="font-medium">{req.username}</span>
                  <span class="block text-xs text-muted-foreground">{req.email}</span>
                </td>
                <td class="px-3 py-2 text-muted-foreground">{relTime(req.requested_at)}</td>
                <td class="px-3 py-2">
                  {#if req.status === "pending"}
                    <span class="text-amber-400">Pending</span>
                  {:else if req.status === "approved"}
                    <span class="text-emerald-400">Approved</span>
                  {:else}
                    <span class="text-muted-foreground">Denied</span>
                  {/if}
                </td>
                <td class="px-3 py-2">
                  {#if req.status === "pending"}
                    <div class="flex gap-1.5">
                      <button
                        type="button"
                        onclick={() => void resolveReset(req.id, "approve")}
                        class="rounded-md bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/25"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onclick={() => void resolveReset(req.id, "deny")}
                        class="rounded-md bg-red-500/15 px-2.5 py-1 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/25"
                      >
                        Deny
                      </button>
                    </div>
                  {:else}
                    <span class="text-xs text-muted-foreground">—</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class="mt-1.5 text-xs text-muted-foreground">
        Verify it's really them before approving (ask in chat or elsewhere) — an approval lets the
        requesting device change the password for 24 hours.
      </p>
    {/if}

    <!-- Registered users -->
    <h2 class="mt-8 text-sm font-medium text-muted-foreground">Registered users</h2>
    <div class="mt-2 overflow-x-auto rounded-xl border border-border">
      <table class="w-full min-w-[720px] text-sm">
        <thead class="bg-card/80 text-left text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2">User</th>
            <th class="px-3 py-2">Role</th>
            <th class="px-3 py-2">Likes</th>
            <th class="px-3 py-2">Lists</th>
            <th class="px-3 py-2">Watching</th>
            <th class="px-3 py-2">Completed</th>
            <th class="px-3 py-2">Planned</th>
            <th class="px-3 py-2">Dropped</th>
            <th class="px-3 py-2">Last active</th>
            <th class="px-3 py-2">Joined</th>
          </tr>
        </thead>
        <tbody>
          {#if loading}
            <tr><td colspan="10" class="px-3 py-6 text-center text-muted-foreground">Loading…</td></tr>
          {:else}
            {#each users as u (u.id)}
              <tr class="border-t border-border/60">
                <td class="px-3 py-2">
                  <span class="font-medium">{u.username}</span>
                  <span class="block text-xs text-muted-foreground">{u.email}</span>
                </td>
                <td class="px-3 py-2">
                  <span class={u.role === "admin" ? "text-primary" : "text-muted-foreground"}>{u.role}</span>
                </td>
                <td class="px-3 py-2">{u.likes_count}</td>
                <td class="px-3 py-2">{u.lists_count}</td>
                <td class="px-3 py-2">{u.watching_count}</td>
                <td class="px-3 py-2">{u.completed_count}</td>
                <td class="px-3 py-2">{u.plan_count}</td>
                <td class="px-3 py-2">{u.dropped_count}</td>
                <td class="px-3 py-2 text-muted-foreground">{relTime(u.last_active_at)}</td>
                <td class="px-3 py-2 text-muted-foreground">{relTime(u.created_at)}</td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  {/if}
</main>
