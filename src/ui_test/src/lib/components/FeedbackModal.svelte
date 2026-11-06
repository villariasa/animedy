<script lang="ts">
  // Feedback modal — open to everyone (guests post under a sticky random
  // nickname). Messages land in the admin-only inbox on #/admin.
  import { fade, fly } from "svelte/transition";
  import Icon from "$lib/components/Icon.svelte";
  import { auth } from "$lib/stores/auth.svelte";
  import { apiSendFeedback, getGuestNickname } from "$lib/api/account";
  import { notificationHistory } from "$lib/stores/notificationHistory.svelte";

  let { isOpen = $bindable(false) }: { isOpen?: boolean } = $props();

  let body = $state("");
  let busy = $state(false);
  let note = $state<{ type: "success" | "error"; message: string } | null>(null);

  const postingAs = $derived(auth.isLoggedIn ? (auth.user?.username ?? "") : getGuestNickname());

  function close(): void {
    isOpen = false;
    note = null;
  }

  async function submit(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    if (busy || !body.trim()) return;
    busy = true;
    note = null;
    try {
      await apiSendFeedback(body.trim());
      void notificationHistory.syncAdminFeedback();
      note = { type: "success", message: "Sent — thank you!" };
      body = "";
      setTimeout(() => close(), 1500);
    } catch (err) {
      note = { type: "error", message: err instanceof Error ? err.message : "Failed to send" };
    } finally {
      busy = false;
    }
  }
</script>

<svelte:window onkeydown={(e) => { if (e.key === "Escape") close(); }} />

{#if isOpen}
  <div
    class="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
    transition:fade={{ duration: 150 }}
    onclick={close}
    onkeydown={(e) => { if (e.key === "Escape") close(); }}
    role="button"
    tabindex="-1"
    aria-label="Close feedback"
  ></div>
  <div
    class="fixed left-1/2 top-1/2 z-[60] w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background/95 p-5 shadow-2xl backdrop-blur-xl"
    transition:fly={{ y: 16, duration: 180 }}
    role="dialog"
    aria-modal="true"
    aria-label="Send feedback"
  >
    <div class="flex items-center justify-between">
      <h2 class="flex items-center gap-2 text-base font-semibold"><Icon name="chat" class="h-4 w-4 text-primary" /> Send feedback</h2>
      <button
        type="button"
        onclick={close}
        class="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label="Close"
      >
        <Icon name="x-mark" class="h-4 w-4" />
      </button>
    </div>
    <p class="mt-1 text-xs text-muted-foreground">
      Goes straight to the Animedy team. Posting as
      <span class="font-medium text-foreground">{postingAs}</span>{auth.isLoggedIn ? "" : " (guest)"}.
    </p>

    <form class="mt-4 flex flex-col gap-3" onsubmit={submit}>
      <textarea
        bind:value={body}
        maxlength="1000"
        rows="4"
        placeholder="Bug reports, requests, anything…"
        class="resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      ></textarea>
      {#if note}
        <p class="text-xs {note.type === 'error' ? 'text-red-400' : 'text-emerald-400'}">{note.message}</p>
      {/if}
      <div class="flex items-center justify-between">
        <span class="text-[10px] text-muted-foreground">{body.length}/1000</span>
        <button
          type="submit"
          disabled={busy || !body.trim()}
          class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send"}
        </button>
      </div>
    </form>
  </div>
{/if}
