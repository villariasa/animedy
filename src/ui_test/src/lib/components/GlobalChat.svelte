<script lang="ts">
  // Global chat — floating bubble (bottom-right) opening a slide-in panel on
  // desktop / bottom sheet on mobile. Read is public; sending needs an
  // account. Admins get delete + mute controls inline.
  import { fly } from "svelte/transition";
  import { chat } from "$lib/stores/chat.svelte";
  import { auth } from "$lib/stores/auth.svelte";
  import { router } from "$lib/router.svelte";
  import { apiChatMute } from "$lib/api/account";

  let draft = $state("");
  let feedEl = $state<HTMLDivElement | undefined>();
  let mutedNotice = $state("");

  // Hide the bubble on auth pages and while watching (it would overlap the
  // player controls; fullscreen hides it anyway).
  const hidden = $derived(
    router.current.name === "watch" ||
      router.current.name === "signin" ||
      router.current.name === "signup"
  );

  // Start the background poll once so the unread badge is live even before
  // the panel is first opened.
  $effect(() => {
    chat.init();
  });

  // Keep the feed pinned to the bottom as messages arrive while open.
  $effect(() => {
    void chat.messages.length;
    if (chat.open && feedEl) {
      feedEl.scrollTop = feedEl.scrollHeight;
    }
  });

  async function submit(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    if (await chat.send(draft)) {
      draft = "";
    }
  }

  function fmtTime(createdAt: string): string {
    const date = new Date(createdAt.includes("T") ? createdAt : createdAt.replace(" ", "T") + "Z");
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  async function muteUser(userId: number, username: string): Promise<void> {
    await apiChatMute(userId, 24).catch(() => undefined);
    mutedNotice = `${username} muted for 24h`;
    setTimeout(() => (mutedNotice = ""), 3000);
  }
</script>

{#if !hidden}
  <!-- Floating bubble -->
  <button
    type="button"
    onclick={() => chat.toggle()}
    class="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card shadow-xl transition-all hover:scale-105 active:scale-95 {chat.open ? 'bg-primary text-primary-foreground' : 'text-foreground'}"
    title={chat.open ? "Close chat" : "Open global chat"}
    aria-label={chat.open ? "Close chat" : "Open global chat"}
  >
    {#if chat.open}
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-5 w-5">
        <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
      </svg>
    {:else}
      <!-- Globe icon — this is the GLOBAL chat -->
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-5 w-5">
        <path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM6.262 6.072a8.25 8.25 0 1 0 10.562-.766 4.5 4.5 0 0 1-1.318 1.357L14.25 7.5l.165.33a.809.809 0 0 1-1.086 1.085l-.604-.302a1.125 1.125 0 0 0-1.298.21l-.132.131c-.439.44-.439 1.152 0 1.591l.296.296c.256.257.622.374.98.314l1.17-.195c.323-.054.654.036.905.245l1.33 1.108c.32.267.46.694.358 1.1a8.7 8.7 0 0 1-2.288 4.04l-.723.724a1.125 1.125 0 0 1-1.298.21l-.153-.076a1.125 1.125 0 0 1-.622-1.006v-1.089c0-.298-.119-.585-.33-.796l-1.347-1.347a1.125 1.125 0 0 1-.21-1.298L9.75 12l-1.64-1.64a6 6 0 0 1-1.676-3.257l-.172-1.03Z" clip-rule="evenodd" />
      </svg>
      {#if chat.unread > 0}
        <span class="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-md ring-2 ring-background">
          {chat.unread > 99 ? "99+" : chat.unread}
        </span>
      {/if}
    {/if}
  </button>

  <!-- Panel -->
  {#if chat.open}
    <div
      transition:fly={{ y: 24, duration: 180 }}
      class="fixed bottom-20 right-4 z-40 flex h-[min(540px,calc(100dvh-7rem))] w-[min(360px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-background/95 shadow-2xl backdrop-blur-xl"
      role="dialog"
      aria-label="Global chat"
    >
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-border/70 px-4 py-2.5">
        <div class="flex items-center gap-2">
          <span class="h-2 w-2 rounded-full bg-emerald-400"></span>
          <span class="text-sm font-semibold">Global chat</span>
        </div>
        {#if mutedNotice}
          <span class="text-xs text-amber-400">{mutedNotice}</span>
        {/if}
      </div>

      <!-- Feed -->
      <div bind:this={feedEl} class="flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
        {#if chat.messages.length === 0}
          <p class="py-8 text-center text-sm text-muted-foreground">No messages yet — say hi!</p>
        {:else}
          {#each chat.messages as msg (msg.id)}
            <div class="group flex items-start gap-2 text-sm">
              <!-- Avatar (uploaded image, or first-letter fallback) -->
              {#if msg.avatar_url}
                <img
                  src={msg.avatar_url}
                  alt={msg.username}
                  loading="lazy"
                  class="mt-0.5 h-7 w-7 shrink-0 rounded-full border border-border/60 object-cover"
                />
              {:else}
                <div class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold uppercase text-primary">
                  {msg.username.slice(0, 1)}
                </div>
              {/if}
              <div class="min-w-0 flex-1">
                <span class="font-semibold {msg.user_id === auth.user?.id ? 'text-primary' : ''}">{msg.username}</span>
                <span class="ml-1.5 text-[10px] text-muted-foreground">{fmtTime(msg.created_at)}</span>
                <p class="break-words text-foreground/90">{msg.body}</p>
              </div>
              {#if auth.isAdmin && msg.user_id !== auth.user?.id}
                <div class="hidden shrink-0 gap-1 group-hover:flex">
                  <button
                    type="button"
                    onclick={() => void chat.remove(msg.id)}
                    class="rounded px-1 text-[10px] text-muted-foreground hover:text-red-400"
                    title="Delete message">✕</button>
                  <button
                    type="button"
                    onclick={() => void muteUser(msg.user_id, msg.username)}
                    class="rounded px-1 text-[10px] text-muted-foreground hover:text-amber-400"
                    title="Mute user 24h">🔇</button>
                </div>
              {/if}
            </div>
          {/each}
        {/if}
      </div>

      <!-- Typing indicator -->
      {#if chat.typingUsers.length > 0}
        <div class="flex items-center gap-2 px-4 pb-1.5 text-xs text-muted-foreground">
          <span class="flex items-end gap-0.5" aria-hidden="true">
            <span class="typing-dot h-1.5 w-1.5 rounded-full bg-primary"></span>
            <span class="typing-dot h-1.5 w-1.5 rounded-full bg-primary" style="animation-delay: 0.15s"></span>
            <span class="typing-dot h-1.5 w-1.5 rounded-full bg-primary" style="animation-delay: 0.3s"></span>
          </span>
          <span class="italic">
            {#if chat.typingUsers.length === 1}
              {chat.typingUsers[0]} is typing…
            {:else if chat.typingUsers.length === 2}
              {chat.typingUsers[0]} and {chat.typingUsers[1]} are typing…
            {:else}
              Several people are typing…
            {/if}
          </span>
        </div>
      {/if}

      <!-- Composer -->
      <div class="border-t border-border/70 p-3">
        {#if auth.isLoggedIn}
          {#if chat.error}
            <p class="mb-1.5 text-xs text-amber-400">{chat.error}</p>
          {/if}
          <form class="flex gap-2" onsubmit={submit}>
            <input
              type="text"
              bind:value={draft}
              oninput={() => chat.notifyTyping()}
              maxlength="500"
              placeholder="Message…"
              class="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={chat.sending || !draft.trim()}
              class="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
            >
              Send
            </button>
          </form>
        {:else}
          <a
            href="#/signin"
            onclick={() => chat.close()}
            class="block rounded-lg border border-border px-3 py-2 text-center text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Sign in to chat
          </a>
        {/if}
      </div>
    </div>
  {/if}
{/if}

<style>
  .typing-dot {
    animation: typing-bounce 1s infinite ease-in-out;
  }
  @keyframes typing-bounce {
    0%, 60%, 100% {
      transform: translateY(0);
      opacity: 0.45;
    }
    30% {
      transform: translateY(-3px);
      opacity: 1;
    }
  }
</style>
