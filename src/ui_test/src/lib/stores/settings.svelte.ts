import type { SettingsPayload, SettingsSaveRequest } from "$lib/api/types";
import { getLocalSettings, saveLocalSettings } from "$lib/db/local";
import { hasToken, apiPutSettings } from "$lib/api/account";

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

/** Maps local settings to the cloud user_settings columns. Local volume is
 * 0..1; the server stores an integer 0..100. The notify_* fields are
 * frontend-only and never synced. */
export function toCloudSettings(s: SettingsPayload): Record<string, unknown> {
  return {
    volume: Math.round(s.volume * 100),
    playback_speed: s.playback_speed,
    subtitle_lang: s.subtitle_lang,
    preferred_quality: s.preferred_quality,
    autoplay: s.autoplay,
    auto_next: s.auto_next,
    auto_skip_intro: s.auto_skip_intro,
    auto_skip_outro: s.auto_skip_outro,
    auto_fullscreen: s.auto_fullscreen,
    countdown_seconds: s.countdown_seconds,
    metadata_source: s.metadata_source,
    skip_source: s.skip_source
  };
}

/** Maps a cloud user_settings row back onto the local payload shape. */
export function fromCloudSettings(row: Record<string, unknown>): Partial<SettingsPayload> {
  const out: Partial<SettingsPayload> = {};
  if (typeof row.volume === "number") out.volume = Math.min(1, Math.max(0, row.volume / 100));
  if (typeof row.playback_speed === "number") out.playback_speed = row.playback_speed;
  if (typeof row.subtitle_lang === "string") out.subtitle_lang = row.subtitle_lang;
  if (typeof row.preferred_quality === "string") out.preferred_quality = row.preferred_quality;
  for (const key of [
    "autoplay",
    "auto_next",
    "auto_skip_intro",
    "auto_skip_outro",
    "auto_fullscreen"
  ] as const) {
    if (typeof row[key] === "number") out[key] = row[key] === 1;
  }
  if (typeof row.countdown_seconds === "number") out.countdown_seconds = row.countdown_seconds;
  if (row.metadata_source === "anilist" || row.metadata_source === "mal") {
    out.metadata_source = row.metadata_source;
  }
  if (row.skip_source === "aniskip" || row.skip_source === "manual") {
    out.skip_source = row.skip_source;
  }
  return out;
}

/** Player settings store ($state) — IndexedDB on this device; when signed in,
 * changes are also written through to the account for cross-device sync. */
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
    if (hasToken()) {
      void apiPutSettings(toCloudSettings($state.snapshot(this.current))).catch(() => undefined);
    }
  }

  /** Apply the cloud copy locally without echoing it back to the server. */
  async applyCloud(row: Record<string, unknown>): Promise<void> {
    this.current = { ...this.current, ...fromCloudSettings(row) };
    this.loaded = true;
    await saveLocalSettings($state.snapshot(this.current)).catch(() => undefined);
  }
}

export const settings = new SettingsStore();
