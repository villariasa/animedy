import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { SettingsPayload } from "$lib/api/types";

/** Local watch progress row (guest mode + offline cache for logged-in users). */
export interface LocalProgress {
  episode_id: number;
  anime_id: number;
  position_seconds: number;
  duration_seconds: number;
  completed: boolean;
  last_watched_at: string;
}

interface CacheEntry {
  key: string;
  data: unknown;
  cached_at: string;
}

interface AnimedyDB extends DBSchema {
  progress: { key: number; value: LocalProgress };
  settings: { key: string; value: SettingsPayload };
  metaCache: { key: string; value: CacheEntry };
}

const DB_NAME = "animedy";
const DB_VERSION = 1;
const SETTINGS_KEY = "player";

let dbPromise: Promise<IDBPDatabase<AnimedyDB>> | null = null;

function db(): Promise<IDBPDatabase<AnimedyDB>> {
  dbPromise ??= openDB<AnimedyDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      database.createObjectStore("progress", { keyPath: "episode_id" });
      database.createObjectStore("settings");
      database.createObjectStore("metaCache", { keyPath: "key" });
    }
  });
  return dbPromise;
}

export async function getLocalProgress(episodeId: number): Promise<LocalProgress | undefined> {
  return (await db()).get("progress", episodeId);
}

export async function saveLocalProgress(progress: LocalProgress): Promise<void> {
  await (await db()).put("progress", progress);
}

export async function getAllLocalProgress(): Promise<LocalProgress[]> {
  return (await db()).getAll("progress");
}

export async function clearLocalProgress(): Promise<void> {
  await (await db()).clear("progress");
}

export async function getLocalSettings(): Promise<SettingsPayload | undefined> {
  return (await db()).get("settings", SETTINGS_KEY);
}

export async function saveLocalSettings(settings: SettingsPayload): Promise<void> {
  await (await db()).put("settings", settings, SETTINGS_KEY);
}

export async function getCached<T>(key: string): Promise<T | undefined> {
  const entry = await (await db()).get("metaCache", key);
  return entry?.data as T | undefined;
}

export async function putCached(key: string, data: unknown): Promise<void> {
  await (await db()).put("metaCache", { key, data, cached_at: new Date().toISOString() });
}

/** Clear all cached API responses — called on logout so user-specific
 * responses (e.g. history) can't leak to the next account on this browser. */
export async function clearMetaCache(): Promise<void> {
  await (await db()).clear("metaCache");
}
