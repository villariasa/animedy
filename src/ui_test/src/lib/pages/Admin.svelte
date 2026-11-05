<script lang="ts">
  // Admin dashboard — live sessions (guests + accounts) and per-user stats.
  // Gated on role=admin client-side; the API enforces it server-side too.
  import { auth } from "$lib/stores/auth.svelte";
  import {
    apiAdminActivity,
    apiAdminUsers,
    type AdminSession,
    type AdminUser
  } from "$lib/api/account";

  let sessions = $state<AdminSession[]>([]);
  let users = $state<AdminUser[]>([]);
  let loading = $state(true);
  let errorMessage = $state("");

  const onlineSessions = $derived(sessions.filter((s) => s.online === 1));
  const watchingSessions = $derived(onlineSessions.filter((s) => s.anime_id !== null));

  async function refresh(): Promise<void> {
    errorMessage = "";
    try {
      const [activity, usersRes] = await Promise.all([apiAdminActivity(), apiAdminUsers()]);
      sessions = activity.sessions;
      users = usersRes.users;
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
      <button
        type="button"
        onclick={() => void refresh()}
        class="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent"
      >
        Refresh
      </button>
    </div>

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
