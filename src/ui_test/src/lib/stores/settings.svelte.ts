import { apiPost } from "$lib/api/client";
import type { SettingsGetResponse, SettingsPayload, SettingsSaveRequest, SettingsSaveResponse } from "$lib/api/types";
import { getLocalSettings, saveLocalSettings } from "$lib/db/local";
import { auth } from "$lib/stores/auth.svelte";

export const DEFAULT_SETTINGS: SettingsPayload = {
  volume: 1,
  playback_speed: 1,
  subtitle_lang: "en",
  preferred_quality: "auto",
  autoplay: true,
  auto_next: true,
  auto_skip_intro: false,
  auto_skip_outro: false,
  auto_fullscreen: false,
  countdown_seconds: 10,
  metadata_source: "anilist",
  skip_source: "aniskip"
};

/**
 * Player settings store ($state). Logged in: server is source of truth
 * (/api/settings/get|save) with IndexedDB as offline cache. Guest: IndexedDB.
 */
class SettingsStore {
  current = $state<SettingsPayload>(DEFAULT_SETTINGS);
  loaded = $state(false);

  async load(): Promise<void> {
    const local = await getLocalSettings().catch(() => undefined);
    if (local) {
      this.current = { ...DEFAULT_SETTINGS, ...local };
    }
    if (auth.isLoggedIn) {
      try {
        const res = await apiPost<SettingsGetResponse>("/api/settings/get");
        this.current = res.settings;
        await saveLocalSettings(res.settings).catch(() => undefined);
      } catch {
        // Offline — keep the cached local copy.
      }
    }
    this.loaded = true;
  }

  async save(patch: SettingsSaveRequest): Promise<void> {
    this.current = { ...this.current, ...patch };
    if (auth.isLoggedIn) {
      try {
        const res = await apiPost<SettingsSaveResponse>("/api/settings/save", patch);
        this.current = res.settings;
      } catch {
        // Patch stays applied locally; next successful save syncs it.
      }
    }
    await saveLocalSettings($state.snapshot(this.current)).catch(() => undefined);
  }
}

export const settings = new SettingsStore();
