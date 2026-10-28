// Shared row fixtures for backend endpoint tests. Franchise fixtures follow
// the PRD's reference graphs (Bleach / Naruto / Attack on Titan).
import type { AnimeRow, UserRow, UserSettingsRow } from "../../interfaces/db.js";

export function makeUserRow(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: 1,
    email: "tester@example.com",
    username: "tester",
    password_hash: "$2a$10$placeholderplaceholderplaceholderplaceha",
    role: "user",
    created_at: "2026-10-28 10:00:00",
    updated_at: "2026-10-28 10:00:00",
    ...overrides
  };
}

export function makeSettingsRow(overrides: Partial<UserSettingsRow> = {}): UserSettingsRow {
  return {
    user_id: 1,
    volume: 1,
    playback_speed: 1,
    subtitle_lang: "en",
    preferred_quality: "auto",
    autoplay: 1,
    auto_next: 1,
    auto_skip_intro: 0,
    auto_skip_outro: 0,
    auto_fullscreen: 0,
    countdown_seconds: 10,
    metadata_source: "anilist",
    skip_source: "aniskip",
    created_at: "2026-10-28 10:00:00",
    updated_at: "2026-10-28 10:00:00",
    ...overrides
  } as UserSettingsRow;
}

export function makeAnimeRow(overrides: Partial<AnimeRow> = {}): AnimeRow {
  return {
    id: 10,
    anilist_id: 269,
    mal_id: 269,
    title_romaji: "Bleach",
    title_english: "Bleach",
    title_native: "BLEACH",
    synonyms: null,
    format: "TV",
    status: "FINISHED",
    season: "FALL",
    season_year: 2004,
    start_date: "2004-10-05",
    end_date: "2012-03-27",
    episode_count: 366,
    episode_duration: 24,
    description: "Ichigo Kurosaki becomes a Soul Reaper.",
    cover_image: "https://example.test/bleach.jpg",
    banner_image: null,
    franchise_key: "269",
    sequence_order: 1,
    season_label: "Season 1",
    arc_name: null,
    metadata_json: null,
    cached_at: new Date().toISOString(),
    created_at: "2026-10-28 10:00:00",
    updated_at: "2026-10-28 10:00:00",
    ...overrides
  };
}
