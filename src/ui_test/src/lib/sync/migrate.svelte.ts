// Guest → account migration and cloud-state hydration.
//
// On the FIRST successful sign-in/sign-up on a device, everything the guest
// collected locally (likes, custom lists, watch statuses, settings) is pushed
// to the account via POST /api/sync/migrate (union merge — cloud wins on
// conflicts), then the merged cloud state replaces the local stores. On later
// logins the cloud state is simply pulled down.

import {
  apiMigrate,
  apiFetchAll,
  apiPutSettings,
  apiFetchProgress,
  apiPushProgressBulk,
  type CloudState,
  type ProgressPushItem
} from "$lib/api/account";
import {
  getAllLocalProgress,
  saveLocalProgress,
  progressKey,
  type LocalProgress
} from "$lib/db/local";
import { likes, type LikedAnime } from "$lib/stores/likes.svelte";
import { customLists, type CustomList, type CustomListEntry } from "$lib/stores/customLists.svelte";
import {
  watchStatusStore,
  type WatchStatus,
  type WatchStatusEntry
} from "$lib/stores/watchStatus.svelte";
import { settings, toCloudSettings } from "$lib/stores/settings.svelte";

const MIGRATED_KEY_PREFIX = "animedy.migrated.";

function migratedKey(userId: number): string {
  return MIGRATED_KEY_PREFIX + userId;
}

function hasMigrated(userId: number): boolean {
  try {
    return localStorage.getItem(migratedKey(userId)) === "1";
  } catch {
    return true; // storage broken — don't try to migrate
  }
}

function markMigrated(userId: number): void {
  try {
    localStorage.setItem(migratedKey(userId), "1");
  } catch {
    // storage disabled
  }
}

function buildMigrationPayload(): Record<string, unknown> {
  const listSnapshots = customLists.lists.map((list) => ({
    name: list.name,
    created_at: list.created_at,
    entries: customLists
      .itemsOf(list.id)
      .map(({ list_id: _listId, ...entry }) => entry)
  }));
  return {
    likes: $state.snapshot(likes.items),
    lists: listSnapshots,
    watch_status: $state.snapshot(watchStatusStore.items),
    settings: toCloudSettings($state.snapshot(settings.current))
  };
}

const VALID_STATUSES = new Set(["watching", "completed", "plan_to_watch", "dropped"]);

/** Replace all local stores with the cloud copy. */
export async function applyCloudState(state: CloudState): Promise<void> {
  likes.replaceAll(
    state.likes.map(
      (row): LikedAnime => ({
        anime_id: row.anime_id,
        title_english: row.title_english ?? null,
        title_romaji: row.title_romaji ?? null,
        cover_image: row.cover_image ?? null,
        format: row.format ?? null,
        season_year: row.season_year ?? null,
        liked_at: row.liked_at
      })
    )
  );

  customLists.replaceAll(
    state.lists.map(
      (row): CustomList => ({ id: String(row.id), name: row.name, created_at: row.created_at })
    ),
    state.list_entries.map(
      (row): CustomListEntry => ({
        list_id: String(row.list_id),
        anime_id: row.anime_id,
        title_english: row.title_english ?? null,
        title_romaji: row.title_romaji ?? null,
        cover_image: row.cover_image ?? null,
        format: row.format ?? null,
        season_year: row.season_year ?? null,
        added_at: row.added_at
      })
    )
  );

  watchStatusStore.replaceAll(
    state.watch_status
      .filter((row) => VALID_STATUSES.has(row.status))
      .map(
        (row): WatchStatusEntry => ({
          anime_id: row.anime_id,
          status: row.status as WatchStatus,
          title_english: row.title_english ?? null,
          title_romaji: row.title_romaji ?? null,
          cover_image: row.cover_image ?? null,
          format: row.format ?? null,
          season_year: row.season_year ?? null,
          updated_at: row.updated_at
        })
      )
  );

  if (state.settings) {
    await settings.applyCloud(state.settings);
  }
}

function toMs(at: string): number {
  const ms = Date.parse(at.includes("T") ? at : at.replace(" ", "T") + "Z");
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Two-way episode-progress merge, newest-wins per (anime, episode):
 * local rows newer than the cloud get pushed up; cloud rows newer than this
 * device get written into IndexedDB — so History, Continue Watching, and
 * Stats reflect what was watched on any device.
 */
export async function syncProgress(): Promise<void> {
  const [local, cloud] = await Promise.all([
    getAllLocalProgress().catch((): LocalProgress[] => []),
    apiFetchProgress().then((r) => r.progress)
  ]);

  const cloudByKey = new Map(cloud.map((row) => [progressKey(row.anime_id, row.episode_number), row]));
  const localByKey = new Map(local.map((row) => [row.episode_id, row]));

  // Push local rows the cloud hasn't seen (or has older copies of).
  const toPush: ProgressPushItem[] = [];
  for (const row of local) {
    if (typeof row.episode_number !== "number") continue;
    const cloudRow = cloudByKey.get(row.episode_id);
    if (!cloudRow || toMs(row.last_watched_at) > toMs(cloudRow.last_watched_at)) {
      toPush.push({
        anime_id: row.anime_id,
        episode_number: row.episode_number,
        position_seconds: row.position_seconds,
        duration_seconds: row.duration_seconds,
        completed: row.completed,
        episode_title: row.episode_title ?? null,
        last_watched_at: row.last_watched_at,
        title_english: row.title_english ?? null,
        title_romaji: row.title_romaji ?? null,
        cover_image: row.cover_image ?? null
      });
    }
  }
  if (toPush.length > 0) {
    await apiPushProgressBulk(toPush.slice(0, 1000)).catch(() => undefined);
  }

  // Pull cloud rows this device hasn't seen (or has older copies of).
  for (const row of cloud) {
    const key = progressKey(row.anime_id, row.episode_number);
    const localRow = localByKey.get(key);
    if (!localRow || toMs(row.last_watched_at) > toMs(localRow.last_watched_at)) {
      await saveLocalProgress({
        episode_id: key,
        anime_id: row.anime_id,
        episode_number: row.episode_number,
        position_seconds: row.position_seconds,
        duration_seconds: row.duration_seconds,
        completed: row.completed === 1,
        last_watched_at: new Date(toMs(row.last_watched_at)).toISOString(),
        episode_title: row.episode_title,
        title_english: row.title_english,
        title_romaji: row.title_romaji,
        cover_image: row.cover_image
      }).catch(() => undefined);
    }
  }
}

/**
 * Runs after every successful auth. First time on this device for this user:
 * push local data up, then adopt the merged cloud state. Afterwards: pull.
 * `freshAccount` (just registered) additionally pushes the local settings,
 * since the register endpoint seeds the row with server defaults.
 */
export async function syncAfterAuth(userId: number, freshAccount: boolean): Promise<void> {
  try {
    let state: CloudState;
    if (!hasMigrated(userId)) {
      await settings.load();
      state = await apiMigrate(buildMigrationPayload());
      if (freshAccount) {
        await apiPutSettings(toCloudSettings($state.snapshot(settings.current))).catch(
          () => undefined
        );
        state.settings = null; // keep the local settings we just pushed
      }
      markMigrated(userId);
    } else {
      state = await apiFetchAll();
    }
    await applyCloudState(state);
    await syncProgress();
  } catch {
    // Sync is best-effort — the user stays signed in and local data remains.
  }
}

/** Sign-out cleanup: wipe account-scoped local copies so a different guest
 * session on this device doesn't inherit the previous account's data. */
export function clearLocalAccountData(): void {
  likes.clearAll();
  customLists.clearAll();
  watchStatusStore.clearAll();
}
