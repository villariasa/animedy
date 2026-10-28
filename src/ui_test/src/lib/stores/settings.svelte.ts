import { apiPost } from "$lib/api/client";
import type { SettingsGetResponse, SettingsPayload, SettingsSaveRequest, SettingsSaveResponse } from "$lib/api/types";
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

const GUEST_STORAGE_KEY = "animedy.settings";

function loadGuestSettings(): SettingsPayload {
  let settings = DEFAULT_SETTINGS;
  const raw = localStorage.getItem(GUEST_STORAGE_KEY);
  if (raw !== null) {
    try {
      settings = { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<SettingsPayload>) };
    } catch {
      settings = DEFAULT_SETTINGS;
    }
  }
  return settings;
}

/**
 * Player settings store ($state). Logged in: server is source of truth
 * (/api/settings/get|save). Guest: localStorage (IndexedDB layer lands in T5.7).
 */
class SettingsStore {
  current = $state<SettingsPayload>(loadGuestSettings());
  loaded = $state(false);

  async load(): Promise<void> {
    if (auth.isLoggedIn) {
      try {
        const res = await apiPost<SettingsGetResponse>("/api/settings/get");
        this.current = res.settings;
      } catch {
        // Keep local settings when the server is unreachable.
      }
    } else {
      this.current = loadGuestSettings();
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
    } else {
      localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(this.current));
    }
  }
}

export const settings = new SettingsStore();
