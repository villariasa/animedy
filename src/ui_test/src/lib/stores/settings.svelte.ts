import type { SettingsPayload, SettingsSaveRequest } from "$lib/api/types";
import { getLocalSettings, saveLocalSettings } from "$lib/db/local";

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
  skip_source: "aniskip",
  notify_episode_updates: true,
  notify_discovery: true
};

/** Player settings store ($state) — stored in IndexedDB on this device only
 * (no accounts, no server). */
class SettingsStore {
  current = $state<SettingsPayload>(DEFAULT_SETTINGS);
  loaded = $state(false);

  async load(): Promise<void> {
    if (!this.loaded) {
      const local = await getLocalSettings().catch(() => undefined);
      if (local) {
        this.current = { ...DEFAULT_SETTINGS, ...local };
      }
      this.loaded = true;
    }
  }

  async save(patch: SettingsSaveRequest): Promise<void> {
    this.current = { ...this.current, ...patch };
    await saveLocalSettings($state.snapshot(this.current)).catch(() => undefined);
  }
}

export const settings = new SettingsStore();
