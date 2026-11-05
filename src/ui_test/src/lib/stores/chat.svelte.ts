// Global chat store — polls GET /api/chat every 4s, but ONLY while the panel
// is open and the tab is visible (the endpoint is edge-cached 3s, so polling
// clients mostly hit the CDN, not the function). Sends are optimistic.

import { apiChatFetch, apiChatSend, apiChatDelete, type ChatMessage } from "$lib/api/account";
import { ApiError } from "$lib/api/client";

const POLL_MS = 4_000;
const MAX_IN_MEMORY = 200;

class ChatStore {
  open = $state(false);
  messages = $state<ChatMessage[]>([]);
  sending = $state(false);
  error = $state("");
  /** Unread count while the panel is closed (after it was opened once). */
  unread = $state(0);

  private latestId = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private everOpened = false;

  toggle(): void {
    this.open = !this.open;
    if (this.open) {
      this.everOpened = true;
      this.unread = 0;
      this.startPolling();
    } else {
      this.stopPolling();
    }
  }

  close(): void {
    this.open = false;
    this.stopPolling();
  }

  private startPolling(): void {
    if (this.timer) return;
    void this.poll();
    this.timer = setInterval(() => {
      if (document.visibilityState === "visible") void this.poll();
    }, POLL_MS);
  }

  private stopPolling(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async poll(): Promise<void> {
    try {
      const data = await apiChatFetch(this.latestId > 0 ? this.latestId : undefined);
      if (data.messages.length > 0) {
        this.merge(data.messages);
        if (!this.open && this.everOpened) {
          this.unread += data.messages.length;
        }
      }
      this.latestId = Math.max(this.latestId, data.latest_id);
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

  async send(body: string): Promise<boolean> {
    const text = body.trim();
    if (!text || this.sending) return false;
    this.sending = true;
    this.error = "";
    try {
      const { message } = await apiChatSend(text);
      this.merge([message]);
      this.latestId = Math.max(this.latestId, message.id);
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

  /** Admin: soft-delete a message (optimistically removed from the feed). */
  async remove(messageId: number): Promise<void> {
    this.messages = this.messages.filter((m) => m.id !== messageId);
    await apiChatDelete(messageId).catch(() => undefined);
  }
}

export const chat = new ChatStore();
