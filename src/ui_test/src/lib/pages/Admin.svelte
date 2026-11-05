<script lang="ts">
  // Admin dashboard — live sessions (guests + accounts) and per-user stats.
  // Gated on role=admin client-side; the API enforces it server-side too.
  import { auth } from "$lib/stores/auth.svelte";
  import {
    apiAdminActivity,
    apiAdminUsers,
    apiAdminResetRequests,
    apiAdminResolveReset,
    apiAnnounce,
    apiAdminFeedback,
    apiAdminDeleteFeedback,
    apiPushStatus,
    apiPushTest,
    apiChatMute,
    apiChatUnmute,
    type PushStatus,
    type FeedbackEntry,
    type AdminSession,
    type AdminUser,
    type PasswordResetRequest
  } from "$lib/api/account";

  import { pushSupported, currentPushSubscription, enablePush, disablePush } from "$lib/push";

  let sessions = $state<AdminSession[]>([]);
  let users = $state<AdminUser[]>([]);
  let resetRequests = $state<PasswordResetRequest[]>([]);
  let feedbackItems = $state<FeedbackEntry[]>([]);

  async function deleteFeedback(id: number): Promise<void> {
    feedbackItems = feedbackItems.filter((f) => f.id !== id);
    await apiAdminDeleteFeedback(id).catch(() => undefined);
  }

  // Push alerts (works even when the PWA is closed)
  let pushEnabled = $state(false);
  let pushBusy = $state(false);
  let pushNote = $state("");
  let pushStatus = $state<PushStatus | null>(null);
  let pushTestBusy = $state(false);

  async function loadPushStatus(): Promise<void> {
    pushStatus = await apiPushStatus().catch(() => null);
  }

  async function firePushTest(target: "admins" | "everyone"): Promise<void> {
    pushTestBusy = true;
    try {
      await apiPushTest(target);
      pushNote = `Test push fired to ${target} — a notification should pop on subscribed devices within seconds.`;
    } catch (err) {
      pushNote = err instanceof Error ? err.message : "Test failed";
    } finally {
      pushTestBusy = false;
    }
  }

  async function muteUser(u: AdminUser): Promise<void> {
    try {
      await apiChatMute(u.id, 24);
      u.muted_until = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : "Failed to mute user";
    }
  }

  async function unmuteUser(u: AdminUser): Promise<void> {
    try {
      await apiChatUnmute(u.id);
      u.muted_until = null;
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : "Failed to unmute user";
    }
  }

  function isMuted(until?: string | null): boolean {
    if (!until) return false;
    const ms = Date.parse(until.includes("T") ? until : until.replace(" ", "T") + "Z");
    return !Number.isNaN(ms) && ms > Date.now();
  }

  $effect(() => {
    if (!auth.isAdmin) return;
    void currentPushSubscription().then((sub) => (pushEnabled = sub !== null));
    void loadPushStatus();
  });

  async function togglePush(): Promise<void> {
    pushBusy = true;
    pushNote = "";
    try {
      if (pushEnabled) {
        await disablePush();
        pushEnabled = false;
      } else {
        const problem = await enablePush();
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

  // Announcement composer
  let annTitle = $state("");
  let annBody = $state("");
  let annBusy = $state(false);
  let annNote = $state("");

  async function sendAnnouncement(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    if (annBusy || !annTitle.trim() || !annBody.trim()) return;
    annBusy = true;
    annNote = "";
    try {
      await apiAnnounce(annTitle.trim(), annBody.trim());
      annNote = "Announcement pushed to every subscribed device.";
      annTitle = "";
      annBody = "";
    } catch (err) {
      annNote = err instanceof Error ? err.message : "Failed to send";
    } finally {
      annBusy = false;
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
      const [activity, usersRes, resets, fb] = await Promise.all([
        apiAdminActivity(),
        apiAdminUsers(),
        apiAdminResetRequests(),
        apiAdminFeedback()
      ]);
      sessions = activity.sessions;
      users = usersRes.users;
      resetRequests = resets.requests;
      feedbackItems = fb.feedback;
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

    <!-- Push diagnostics — the first stop when "notifications aren't working" -->
    {#if pushStatus}
      <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-border bg-card/60 px-4 py-2.5 text-xs">
        <span class={pushStatus.vapid_configured ? "text-emerald-400" : "text-red-400 font-semibold"}>
          {pushStatus.vapid_configured
            ? "✓ Push keys configured"
            : "✗ VAPID keys NOT set — no push can be delivered until VAPID_PRIVATE_JWK + VAPID_PUBLIC_KEY are set in the Pages env"}
        </span>
        <span class="text-muted-foreground">
          Subscribed devices: <span class="font-semibold text-foreground">{pushStatus.subscriptions_total}</span>
          (admin: {pushStatus.subscriptions_admin})
        </span>
        {#if pushStatus.subscriptions_total === 0}
          <span class="text-amber-400">No device has enabled notifications yet — nothing to deliver to.</span>
        {/if}
        <span class="ml-auto flex gap-1.5">
          <button
            type="button"
            disabled={pushTestBusy}
            onclick={() => void firePushTest("admins")}
            class="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            Test → admins
          </button>
          <button
            type="button"
            disabled={pushTestBusy}
            onclick={() => void firePushTest("everyone")}
            class="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            Test → everyone
          </button>
        </span>
      </div>
    {/if}

    {#if errorMessage}
      <p class="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
        {errorMessage}
      </p>
    {/if}

    <!-- Announcement composer -->
    <section class="mt-4 rounded-xl border border-border bg-card/80 p-4">
      <h2 class="text-sm font-medium">📢 Send announcement</h2>
      <p class="mt-0.5 text-xs text-muted-foreground">
        Pushed as an OS notification to every device that enabled notifications — even with the app closed.
      </p>
      <form class="mt-3 flex flex-col gap-2" onsubmit={sendAnnouncement}>
        <input
          type="text"
          bind:value={annTitle}
          maxlength="100"
          placeholder="Title (e.g. New episodes are up!)"
          class="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <textarea
          bind:value={annBody}
          maxlength="500"
          rows="2"
          placeholder="Message…"
          class="resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        ></textarea>
        <div class="flex items-center justify-between gap-2">
          {#if annNote}
            <span class="text-xs text-muted-foreground">{annNote}</span>
          {:else}
            <span></span>
          {/if}
          <button
            type="submit"
            disabled={annBusy || !annTitle.trim() || !annBody.trim()}
            class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
          >
            {annBusy ? "Sending…" : "Push announcement"}
          </button>
        </div>
      </form>
    </section>

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

    <!-- Feedback inbox -->
    <h2 class="mt-8 text-sm font-medium text-muted-foreground">
      Feedback
      {#if feedbackItems.length > 0}
        <span class="ml-1.5 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">{feedbackItems.length}</span>
      {/if}
    </h2>
    <div class="mt-2 rounded-xl border border-border">
      {#if feedbackItems.length === 0}
        <p class="px-4 py-6 text-center text-sm text-muted-foreground">No feedback yet</p>
      {:else}
        <ul class="divide-y divide-border/60">
          {#each feedbackItems as fb (fb.id)}
            <li class="group flex items-start gap-3 px-4 py-3">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium">{fb.nickname}</span>
                  {#if fb.user_id === null}
                    <span class="rounded bg-accent/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">Guest</span>
                  {/if}
                  <span class="text-[10px] text-muted-foreground">{relTime(fb.created_at)}</span>
                </div>
                <p class="mt-0.5 break-words text-sm text-foreground/90">{fb.body}</p>
              </div>
              <button
                type="button"
                onclick={() => void deleteFeedback(fb.id)}
                class="shrink-0 rounded-md px-2 py-1 text-xs text-muted-foreground opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
                title="Delete feedback"
              >
                ✕
              </button>
            </li>
          {/each}
        </ul>
      {/if}
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
            <th class="px-3 py-2">Chat status</th>
            <th class="px-3 py-2 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {#if loading}
            <tr><td colspan="12" class="px-3 py-6 text-center text-muted-foreground">Loading…</td></tr>
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
                <td class="px-3 py-2">
                  {#if isMuted(u.muted_until)}
                    <span
                      class="inline-flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-400"
                      title={u.mute_reason ? `Reason: ${u.mute_reason}` : "Muted"}
                    >
                      🔇 Muted
                    </span>
                  {:else}
                    <span class="text-xs text-muted-foreground">Active</span>
                  {/if}
                </td>
                <td class="px-3 py-2 text-right">
                  {#if u.role !== "admin"}
                    {#if isMuted(u.muted_until)}
                      <button
                        type="button"
                        onclick={() => void unmuteUser(u)}
                        class="rounded-md bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/25"
                      >
                        Unmute
                      </button>
                    {:else}
                      <button
                        type="button"
                        onclick={() => void muteUser(u)}
                        class="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-400"
                      >
                        Mute
                      </button>
                    {/if}
                  {/if}
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  {/if}
</main>
