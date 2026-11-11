<script lang="ts">
  // Global chat — floating bubble (bottom-right) opening a slide-in panel on
  // desktop / bottom sheet on mobile. Read is public; sending needs an
  // account. Admins get delete + mute controls inline.
  import { fly } from "svelte/transition";
  import Icon from "$lib/components/Icon.svelte";
  import { chat } from "$lib/stores/chat.svelte";
  import { auth } from "$lib/stores/auth.svelte";
  import { router } from "$lib/router.svelte";
  import {
    apiChatMute,
    apiChatUnmute,
    apiChatGifSearch,
    CHAT_ATTACHMENT_MIME_TYPES,
    MAX_CHAT_ATTACHMENT_BYTES,
    type GifResult
  } from "$lib/api/account";

  let draft = $state("");
  let feedEl = $state<HTMLDivElement | undefined>();
  let mutedNotice = $state("");
  let fileInputEl = $state<HTMLInputElement | undefined>();
  let lightboxUrl = $state<string | null>(null);

  // Quick-react picker: which message (if any) currently has its emoji
  // popover open. Common picks up top, plus a free-text field below for
  // "any emoji" — same idea as Discord's reaction bar.
  const QUICK_EMOJI = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "🎉"];
  let reactionPickerFor = $state<number | null>(null);
  let customEmojiDraft = $state("");

  // GIF picker
  let gifPickerOpen = $state(false);
  let gifQuery = $state("");
  let gifResults = $state<GifResult[]>([]);
  let gifLoading = $state(false);
  let gifError = $state("");
  let gifSearchTimer: ReturnType<typeof setTimeout> | null = null;

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

  async function onFileSelected(e: Event): Promise<void> {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ""; // allow re-selecting the same file next time
    if (!file) return;

    if (!CHAT_ATTACHMENT_MIME_TYPES.has(file.type)) {
      chat.error = "Use a JPEG, PNG, WebP or GIF image";
      return;
    }
    if (file.size > MAX_CHAT_ATTACHMENT_BYTES) {
      chat.error = "File is too large — max 8 MB";
      return;
    }
    await chat.sendAttachment(file, draft);
    draft = "";
  }

  function toggleReactionPicker(messageId: number): void {
    reactionPickerFor = reactionPickerFor === messageId ? null : messageId;
    customEmojiDraft = "";
  }

  async function pickReaction(messageId: number, emoji: string): Promise<void> {
    reactionPickerFor = null;
    customEmojiDraft = "";
    await chat.toggleReaction(messageId, emoji);
  }

  function submitCustomEmoji(e: SubmitEvent, messageId: number): void {
    e.preventDefault();
    const emoji = customEmojiDraft.trim();
    if (!emoji) return;
    void pickReaction(messageId, emoji);
  }

  function openGifPicker(): void {
    gifPickerOpen = true;
    gifError = "";
    if (gifResults.length === 0) void runGifSearch("");
  }

  function closeGifPicker(): void {
    gifPickerOpen = false;
  }

  async function runGifSearch(query: string): Promise<void> {
    gifLoading = true;
    gifError = "";
    try {
      const { results } = await apiChatGifSearch(query);
      gifResults = results;
    } catch (err) {
      gifError = err instanceof Error ? err.message : "GIF search failed";
      gifResults = [];
    } finally {
      gifLoading = false;
    }
  }

  function onGifQueryInput(): void {
    if (gifSearchTimer) clearTimeout(gifSearchTimer);
    gifSearchTimer = setTimeout(() => void runGifSearch(gifQuery), 400);
  }

  async function pickGif(gif: GifResult): Promise<void> {
    gifPickerOpen = false;
    await chat.sendGif(gif.url, draft);
    draft = "";
  }

  function fmtTime(createdAt: string): string {
    const date = new Date(createdAt.includes("T") ? createdAt : createdAt.replace(" ", "T") + "Z");
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  async function muteUser(userId: number, username: string): Promise<void> {
    await apiChatMute(userId, 24).catch(() => undefined);
    for (const m of chat.messages) {
      if (m.user_id === userId) m.is_muted = 1;
    }
    mutedNotice = `${username} muted for 24h`;
    setTimeout(() => (mutedNotice = ""), 3000);
  }

  async function unmuteUser(userId: number, username: string): Promise<void> {
    await apiChatUnmute(userId).catch(() => undefined);
    for (const m of chat.messages) {
      if (m.user_id === userId) m.is_muted = 0;
    }
    mutedNotice = `${username} unmuted`;
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
        {#key chat.unread}
          <span class="unread-badge absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-md ring-2 ring-background">
            {chat.unread > 99 ? "99+" : chat.unread}
          </span>
        {/key}
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
                {#if msg.is_muted && auth.isAdmin}
                  <span class="ml-1.5 rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-bold text-amber-400">muted</span>
                {/if}
                <span class="ml-1.5 text-[10px] text-muted-foreground">{fmtTime(msg.created_at)}</span>
                {#if msg.body}
                  <p class="break-words text-foreground/90">{msg.body}</p>
                {/if}
                {#if msg.attachment_url}
                  <button
                    type="button"
                    onclick={() => (lightboxUrl = msg.attachment_url ?? null)}
                    class="mt-1 block overflow-hidden rounded-lg border border-border/60"
                  >
                    <img
                      src={msg.attachment_url}
                      alt={msg.attachment_type === "image/gif" ? "GIF attachment" : "Image attachment"}
                      loading="lazy"
                      class="max-h-48 max-w-[220px] object-contain"
                    />
                  </button>
                {/if}

                <!-- Reaction pills -->
                {#if msg.reactions && msg.reactions.length > 0}
                  <div class="mt-1 flex flex-wrap gap-1">
                    {#each msg.reactions as r (r.emoji)}
                      <button
                        type="button"
                        onclick={() => void pickReaction(msg.id, r.emoji)}
                        disabled={!auth.isLoggedIn}
                        class="flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition-colors {auth.user && r.user_ids.includes(auth.user.id)
                          ? 'border-primary/60 bg-primary/15 text-primary'
                          : 'border-border/60 text-muted-foreground hover:bg-accent'}"
                      >
                        <span>{r.emoji}</span>
                        <span class="text-[10px] font-semibold">{r.count}</span>
                      </button>
                    {/each}
                  </div>
                {/if}

                <!-- Add-reaction trigger + popover -->
                {#if auth.isLoggedIn}
                  <div class="relative mt-1 inline-block">
                    <button
                      type="button"
                      onclick={() => toggleReactionPicker(msg.id)}
                      class="rounded-full border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100 {reactionPickerFor === msg.id ? 'opacity-100' : ''}"
                      title="Add reaction"
                      aria-label="Add reaction"
                    >
                      + 😊
                    </button>
                    {#if reactionPickerFor === msg.id}
                      <div class="absolute bottom-full left-0 z-10 mb-1 w-48 rounded-lg border border-border bg-popover p-2 shadow-xl">
                        <div class="flex flex-wrap gap-1">
                          {#each QUICK_EMOJI as e (e)}
                            <button
                              type="button"
                              onclick={() => void pickReaction(msg.id, e)}
                              class="rounded p-1 text-base hover:bg-accent"
                            >
                              {e}
                            </button>
                          {/each}
                        </div>
                        <form onsubmit={(e) => submitCustomEmoji(e, msg.id)} class="mt-1.5 flex gap-1">
                          <input
                            type="text"
                            bind:value={customEmojiDraft}
                            maxlength="16"
                            placeholder="Any emoji…"
                            class="min-w-0 flex-1 rounded border border-border bg-background px-1.5 py-1 text-xs outline-none focus:border-primary"
                          />
                          <button
                            type="submit"
                            disabled={!customEmojiDraft.trim()}
                            class="rounded bg-primary px-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
                          >
                            Add
                          </button>
                        </form>
                      </div>
                    {/if}
                  </div>
                {/if}
              </div>
              {#if auth.isAdmin && msg.user_id !== auth.user?.id}
                <div class="hidden shrink-0 items-center gap-1 group-hover:flex">
                  <button
                    type="button"
                    onclick={() => void chat.remove(msg.id)}
                    class="rounded px-1 text-[10px] text-muted-foreground hover:text-red-400"
                    title="Delete message"><Icon name="x-mark" class="h-3.5 w-3.5" /></button>
                  {#if msg.is_muted}
                    <button
                      type="button"
                      onclick={() => void unmuteUser(msg.user_id, msg.username)}
                      class="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/25"
                      title="Unmute user">Unmute</button>
                  {:else}
                    <button
                      type="button"
                      onclick={() => void muteUser(msg.user_id, msg.username)}
                      class="rounded px-1 text-[10px] text-muted-foreground hover:text-amber-400"
                      title="Mute user 24h"><Icon name="speaker-x" class="h-3.5 w-3.5" /></button>
                  {/if}
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
      <div class="relative border-t border-border/70 p-3">
        {#if auth.isLoggedIn}
          {#if chat.error}
            <p class="mb-1.5 text-xs text-amber-400">{chat.error}</p>
          {/if}

          <!-- GIF search panel -->
          {#if gifPickerOpen}
            <div class="absolute bottom-full left-3 right-3 z-10 mb-2 flex h-72 flex-col overflow-hidden rounded-lg border border-border bg-popover shadow-xl">
              <div class="flex items-center gap-2 border-b border-border/70 p-2">
                <input
                  type="text"
                  bind:value={gifQuery}
                  oninput={onGifQueryInput}
                  placeholder="Search GIFs…"
                  class="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onclick={closeGifPicker}
                  class="rounded p-1 text-muted-foreground hover:text-foreground"
                  aria-label="Close GIF search"><Icon name="x-mark" class="h-3.5 w-3.5" /></button>
              </div>
              <div class="flex-1 overflow-y-auto p-2">
                {#if gifLoading}
                  <p class="py-8 text-center text-xs text-muted-foreground">Searching…</p>
                {:else if gifError}
                  <p class="py-8 text-center text-xs text-amber-400">{gifError}</p>
                {:else if gifResults.length === 0}
                  <p class="py-8 text-center text-xs text-muted-foreground">No GIFs found — try another search.</p>
                {:else}
                  <div class="grid grid-cols-3 gap-1.5">
                    {#each gifResults as gif (gif.id)}
                      <button
                        type="button"
                        onclick={() => void pickGif(gif)}
                        class="overflow-hidden rounded-md border border-border/60 hover:border-primary"
                      >
                        <img src={gif.preview_url} alt="GIF" loading="lazy" class="h-20 w-full object-cover" />
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
              <p class="border-t border-border/70 px-2 py-1 text-[10px] text-muted-foreground">Powered by GIPHY</p>
            </div>
          {/if}

          <form class="flex gap-2" onsubmit={submit}>
            <input
              bind:this={fileInputEl}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              class="hidden"
              onchange={onFileSelected}
            />
            <button
              type="button"
              onclick={() => fileInputEl?.click()}
              disabled={chat.uploading}
              title="Send an image"
              aria-label="Send an image"
              class="flex shrink-0 items-center justify-center rounded-lg border border-border px-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              {#if chat.uploading}
                <span class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
              {:else}
                <Icon name="photo" class="h-4 w-4" />
              {/if}
            </button>
            <button
              type="button"
              onclick={() => (gifPickerOpen ? closeGifPicker() : openGifPicker())}
              title="Search and send a GIF"
              aria-label="Search and send a GIF"
              class="flex shrink-0 items-center justify-center rounded-lg border px-2 text-[11px] font-bold tracking-tight transition-colors {gifPickerOpen
                ? 'border-primary bg-primary/15 text-primary'
                : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'}"
            >
              GIF
            </button>
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

  <!-- Attachment lightbox -->
  {#if lightboxUrl}
    <button
      type="button"
      onclick={() => (lightboxUrl = null)}
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
      aria-label="Close image"
    >
      <img src={lightboxUrl} alt="Attachment" class="max-h-full max-w-full rounded-lg object-contain" />
    </button>
  {/if}
{/if}

<style>
  /* Pop-in whenever the unread count changes ({#key} re-mounts the badge). */
  .unread-badge {
    animation: badge-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @keyframes badge-pop {
    0% {
      transform: scale(0.4);
      opacity: 0;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

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
