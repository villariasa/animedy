// Global chat store — polls GET /api/chat every 4s, but ONLY while the panel
// is open and the tab is visible (the endpoint is edge-cached 3s, so polling
// clients mostly hit the CDN, not the function). Sends are optimistic.

import {
  apiChatFetch,
  apiChatSend,
  apiChatDelete,
  apiChatTyping,
  apiUploadChatAttachment,
  hasToken,
  loadStoredUser,
  type ChatMessage
} from "$lib/api/account";
import { ApiError } from "$lib/api/client";

const POLL_OPEN_MS = 4_000;
// Background polling while the panel is closed keeps the unread badge live
// without a reload. 10s feels near-instant; the GET is edge-cached (3s), so
// most of these are CDN cache hits that never touch the function or D1.
const POLL_CLOSED_MS = 10_000;
const MAX_IN_MEMORY = 200;
const LAST_READ_KEY = "animedy.chat_last_read";

function loadLastRead(): number {
  try {
    return Number(localStorage.getItem(LAST_READ_KEY)) || 0;
  } catch {
    return 0;
  }
}

class ChatStore {
  open = $state(false);
  messages = $state<ChatMessage[]>([]);
  sending = $state(false);
  uploading = $state(false);
  error = $state("");
  /** Messages newer than the last one seen on this device. */
  unread = $state(0);
  /** Usernames currently typing (excluding yourself). */
  typingUsers = $state<string[]>([]);

  private latestId = 0;
  private lastReadId = loadLastRead();
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastTypingPing = 0;

  /** Called from the composer on input — throttled "I'm typing" ping. */
  notifyTyping(): void {
    if (!hasToken()) return;
    const now = Date.now();
    if (now - this.lastTypingPing < 2_500) return;
    this.lastTypingPing = now;
    void apiChatTyping().catch(() => undefined);
  }

  private initialized = false;

  /** Called once from GlobalChat on mount — starts the background poll so the
   * unread badge works before the panel is ever opened. */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.startPolling();
    // Coming back to the tab → check immediately instead of waiting a tick.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void this.poll();
    });
  }

  toggle(): void {
    this.open = !this.open;
    if (this.open) {
      this.markRead();
    }
    this.startPolling(); // re-arm at the open/closed cadence
  }

  close(): void {
    this.open = false;
    this.startPolling();
  }

  private markRead(): void {
    this.lastReadId = Math.max(this.lastReadId, this.latestId);
    this.unread = 0;
    try {
      localStorage.setItem(LAST_READ_KEY, String(this.lastReadId));
    } catch {
      // storage disabled
    }
  }

  private startPolling(): void {
    if (this.timer) clearInterval(this.timer);
    void this.poll();
    this.timer = setInterval(
      () => {
        if (document.visibilityState === "visible") void this.poll();
      },
      this.open ? POLL_OPEN_MS : POLL_CLOSED_MS
    );
  }

  private async poll(): Promise<void> {
    try {
      const data = await apiChatFetch(this.latestId > 0 ? this.latestId : undefined);
      if (data.messages.length > 0) {
        this.merge(data.messages);
      }
      this.latestId = Math.max(this.latestId, data.latest_id);
      const me = loadStoredUser()?.username;
      this.typingUsers = (data.typing ?? []).filter((name) => name !== me);
      if (this.open) {
        this.markRead();
      } else {
        this.unread = this.messages.filter((m) => m.id > this.lastReadId).length;
      }
    } catch {
      // transient network/API failure — next tick retries
    }
  }

  private merge(incoming: ChatMessage[]): void {
    const known = new Set(this.messages.map((m) => m.id));
    const fresh = incoming.filter((m) => !known.has(m.id));
    if (fresh.length === 0) return;
    this.messages = [...this.messages, ...fresh]
      .sort((a, b) => a.id - b.id)
      .slice(-MAX_IN_MEMORY);
  }

  async send(body: string, attachment?: { url: string; type: string }): Promise<boolean> {
    const text = body.trim();
    if ((!text && !attachment) || this.sending) return false;
    this.sending = true;
    this.error = "";
    try {
      const { message } = await apiChatSend(text, attachment);
      this.merge([message]);
      this.latestId = Math.max(this.latestId, message.id);
      this.markRead(); // your own message is never "unread"
      return true;
    } catch (err) {
      this.error =
        err instanceof ApiError && err.httpCode === 429
          ? "Slow down — one message every 2 seconds"
          : err instanceof Error
            ? err.message
            : "Failed to send";
      return false;
    } finally {
      this.sending = false;
    }
  }

  /** Upload an image/GIF then send it as (or alongside) a message. */
  async sendAttachment(file: File, caption = ""): Promise<boolean> {
    if (this.uploading || this.sending) return false;
    this.uploading = true;
    this.error = "";
    try {
      const { url, type } = await apiUploadChatAttachment(file);
      return await this.send(caption, { url, type });
    } catch (err) {
      this.error =
        err instanceof ApiError && err.httpCode === 429
          ? "Slow down — wait a few seconds between uploads"
          : err instanceof Error
            ? err.message
            : "Failed to upload";
      return false;
    } finally {
      this.uploading = false;
    }
  }

  /** Admin: soft-delete a message (optimistically removed from the feed). */
  async remove(messageId: number): Promise<void> {
    this.messages = this.messages.filter((m) => m.id !== messageId);
    await apiChatDelete(messageId).catch(() => undefined);
  }
}

export const chat = new ChatStore();
