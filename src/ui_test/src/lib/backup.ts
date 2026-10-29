// Full-account export/import. Everything in this app lives in localStorage
// (likes, watch status) and IndexedDB (progress, player settings) on this
// one device/browser — there's no server backup, so clearing site data loses
// it permanently. This lets users snapshot and restore that state manually.
import { DEFAULT_SETTINGS, settings } from "$lib/stores/settings.svelte";
import { likes, LIKES_STORAGE_KEY, type LikedAnime } from "$lib/stores/likes.svelte";
import {
  watchStatusStore,
  WATCH_STATUS_STORAGE_KEY,
  type WatchStatusEntry
} from "$lib/stores/watchStatus.svelte";
import {
  clearLocalProgress,
  getAllLocalProgress,
  getLocalSettings,
  saveLocalProgress,
  saveLocalSettings,
  type LocalProgress
} from "$lib/db/local";
import type { SettingsPayload } from "$lib/api/types";

const BACKUP_VERSION = 1;

export interface BackupPayload {
  version: number;
  exported_at: string;
  likes: LikedAnime[];
  watch_status: WatchStatusEntry[];
  progress: LocalProgress[];
  settings: SettingsPayload;
}

function readJsonArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

export async function buildBackup(): Promise<BackupPayload> {
  return {
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    likes: readJsonArray<LikedAnime>(LIKES_STORAGE_KEY),
    watch_status: readJsonArray<WatchStatusEntry>(WATCH_STATUS_STORAGE_KEY),
    progress: await getAllLocalProgress(),
    settings: (await getLocalSettings()) ?? DEFAULT_SETTINGS
  };
}

export function downloadBackup(payload: BackupPayload): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `animedy-backup-${payload.exported_at.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export class BackupParseError extends Error {}

function parseBackup(text: string): BackupPayload {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupParseError("That file isn't valid JSON.");
  }
  if (typeof data !== "object" || data === null || !("version" in data)) {
    throw new BackupParseError("That doesn't look like an Animedy backup file.");
  }
  return data as BackupPayload;
}

/** Overwrites all local data with the backup's contents. */
export async function restoreBackup(text: string): Promise<void> {
  const payload = parseBackup(text);

  localStorage.setItem(LIKES_STORAGE_KEY, JSON.stringify(payload.likes ?? []));
  likes.restore();

  localStorage.setItem(WATCH_STATUS_STORAGE_KEY, JSON.stringify(payload.watch_status ?? []));
  watchStatusStore.restore();

  await clearLocalProgress();
  for (const row of payload.progress ?? []) {
    await saveLocalProgress(row);
  }

  const restoredSettings = { ...DEFAULT_SETTINGS, ...(payload.settings ?? {}) };
  await saveLocalSettings(restoredSettings);
  settings.current = restoredSettings;
  settings.loaded = true;
}
