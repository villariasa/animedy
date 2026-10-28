import { apiPost } from "$lib/api/client";
import type { ProgressGetResponse } from "$lib/api/types";
import { clearLocalProgress, getAllLocalProgress } from "$lib/db/local";

/**
 * Merge guest IndexedDB progress into the server account after login —
 * newest `last_watched_at` wins (PRD §7). Local rows that win are pushed via
 * /api/progress/save (+ /api/progress/complete when completed); the local
 * store is cleared afterwards so the server stays the source of truth.
 */
export async function mergeGuestProgress(): Promise<void> {
  const localRows = await getAllLocalProgress().catch(() => []);
  for (const row of localRows) {
    try {
      const server = await apiPost<ProgressGetResponse>("/api/progress/get", {
        episode_id: row.episode_id
      }).catch(() => null);
      const serverAt = server?.last_watched_at ? Date.parse(server.last_watched_at) : 0;
      const localAt = Date.parse(row.last_watched_at);
      if (localAt > serverAt) {
        await apiPost("/api/progress/save", {
          episode_id: row.episode_id,
          position_seconds: Math.floor(row.position_seconds),
          duration_seconds: Math.floor(row.duration_seconds)
        });
        if (row.completed && !server?.completed) {
          await apiPost("/api/progress/complete", { episode_id: row.episode_id });
        }
      }
    } catch {
      // Skip rows that fail to merge; they stay local until the next login.
      return;
    }
  }
  await clearLocalProgress().catch(() => undefined);
}
