// Guest → account migration and cloud-state hydration.
//
// On the FIRST successful sign-in/sign-up on a device, everything the guest
// collected locally (likes, custom lists, watch statuses, settings) is pushed
// to the account via POST /api/sync/migrate (union merge — cloud wins on
// conflicts), then the merged cloud state replaces the local stores. On later
// logins the cloud state is simply pulled down.

import { apiMigrate, apiFetchAll, apiPutSettings, type CloudState } from "$lib/api/account";
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
