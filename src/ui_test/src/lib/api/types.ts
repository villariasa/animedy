/** Standard backend response envelope (CODING_CONVENTION_TECHSTACK.md). */
export interface ApiEnvelope<T> {
  success: boolean;
  http_code: number;
  message: string;
  data: T | null;
}

/** Mirrors `AuthUserProfile` in src/animedy_v1/interfaces/api.ts. */
export interface UserProfile {
  id: number;
  email: string;
  username: string;
  role: "user" | "admin";
  created_at: string;
}

export interface AuthRegisterRequest {
  email: string;
  username: string;
  password: string;
}

export interface AuthLoginRequest {
  email: string;
  password: string;
}

/** Shape of `/api/auth/register` and `/api/auth/login` response data. */
export interface AuthTokenResponse {
  user: UserProfile;
  token: string;
}

export interface AuthMeResponse {
  user: UserProfile;
  has_settings: boolean;
}

export type MetadataSource = "anilist" | "mal";
export type AnimeFormat = "TV" | "MOVIE" | "OVA" | "ONA" | "SPECIAL" | "TV_SHORT" | "MUSIC";
export type AnimeStatus = "FINISHED" | "RELEASING" | "NOT_YET_RELEASED" | "CANCELLED" | "HIATUS";

export interface AnimeSearchRequest {
  query: string;
  metadata_source?: MetadataSource;
}

/** Mirrors `AnimeSearchResultItem` in src/animedy_v1/interfaces/api.ts. */
export interface AnimeSearchResultItem {
  anime_id: number;
  anilist_id: number | null;
  mal_id: number | null;
  title_romaji: string | null;
  title_english: string | null;
  cover_image: string | null;
  banner_image?: string | null;
  format: AnimeFormat | null;
  status: AnimeStatus | null;
  season_year: number | null;
  description?: string | null;
  score?: number | null;
  genres?: string[];
  latest_episode?: number | null;
  airing_at?: number | null;
  episode_thumbnail?: string | null;
  episode_title?: string | null;
  trailer_thumbnail?: string | null;
  trailer_id?: string | null;
}

export interface AnimeSearchResponse {
  results: AnimeSearchResultItem[];
}

/** Mirrors `ContinueWatchingItem` in src/animedy_v1/interfaces/api.ts. */
export interface ContinueWatchingItem {
  franchise_key: string;
  anime_id: number;
  title_romaji: string | null;
  title_english: string | null;
  season_label: string | null;
  episode_id: number;
  episode_number: number;
  progress_percent: number;
  remaining_seconds: number;
  last_watched_at: string;
}

export interface ContinueWatchingListResponse {
  items: ContinueWatchingItem[];
}

export type AnimeSeason = "WINTER" | "SPRING" | "SUMMER" | "FALL";

/** Mirrors `AnimeRow` in src/animedy_v1/interfaces/db.ts (fields the UI uses). */
export interface AnimeDetails {
  score?: number | null;
  popularity?: number | null;
  genres?: string[];
  id: number;
  anilist_id: number | null;
  mal_id: number | null;
  title_romaji: string | null;
  title_english: string | null;
  title_native: string | null;
  synonyms: string[] | null;
  format: AnimeFormat | null;
  status: AnimeStatus | null;
  season: AnimeSeason | null;
  season_year: number | null;
  start_date: string | null;
  end_date: string | null;
  episode_count: number | null;
  episode_duration: number | null;
  description: string | null;
  cover_image: string | null;
  banner_image: string | null;
  franchise_key: string | null;
  sequence_order: number | null;
  season_label: string | null;
  arc_name: string | null;
  trailer_id?: string | null;
  total_episodes?: number | null;
  next_airing_episode?: { episode: number; airing_at: number } | null;
}

export interface AnimeDetailsResponse {
  anime: AnimeDetails;
}

/** Mirrors `FranchiseEntry` in src/animedy_v1/interfaces/api.ts. */
export interface FranchiseEntry {
  status?: AnimeStatus | null;
  anime_id: number;
  anilist_id: number | null;
  title_romaji: string | null;
  title_english: string | null;
  cover_image?: string | null;
  format: AnimeFormat | null;
  season_label: string | null;
  arc_name: string | null;
  sequence_order: number | null;
  episode_count: number | null;
  start_date: string | null;
}

export interface AnimeFranchiseResponse {
  franchise_key: string;
  entries: FranchiseEntry[];
}

/** Mirrors `EpisodeListItem` in src/animedy_v1/interfaces/api.ts. */
export interface EpisodeListItem {
  episode_id: number;
  episode_number: number;
  title: string | null;
  duration_seconds: number | null;
  air_date: string | null;
  thumbnail: string | null;
}

export interface EpisodesListResponse {
  episodes: EpisodeListItem[];
}

export type WatchNextType =
  | "RESUME"
  | "NEXT_EPISODE"
  | "NEXT_SEASON"
  | "SEQUEL"
  | "MOVIE"
  | "SPECIAL_OR_OVA"
  | "RECOMMENDATION"
  | "NONE";

export interface WatchNextAnimeSummary {
  anime_id: number;
  title_romaji: string | null;
  title_english: string | null;
  format: AnimeFormat | null;
  season_label: string | null;
}

export interface WatchNextEpisodeSummary {
  episode_id: number;
  episode_number: number;
  title: string | null;
  resume_position_seconds: number;
}

/** Mirrors `WatchNextGetResponse` in src/animedy_v1/interfaces/api.ts. */
export interface WatchNextGetResponse {
  type: WatchNextType;
  anime: WatchNextAnimeSummary | null;
  episode: WatchNextEpisodeSummary | null;
  reason: string;
}

export interface SubtitleTrack {
  lang: string;
  label: string;
  url: string;
}

export interface QualityVariant {
  label: string;
  url: string;
}

/** Mirrors `EpisodesSourcesResponse` in src/animedy_v1/interfaces/api.ts. */
export interface EpisodesSourcesResponse {
  episode_id: number;
  stream_url: string;
  subtitles: SubtitleTrack[];
  qualities: QualityVariant[];
  official_url?: string | null;
  official_site?: string | null;
}

export type SkipSource = "aniskip" | "manual";
export type SkipType = "intro" | "outro" | "recap";

export interface SkipSegment {
  skip_type: SkipType;
  start_seconds: number;
  end_seconds: number;
  source: SkipSource;
}

export interface SkipGetResponse {
  episode_id: number;
  segments: SkipSegment[];
}

export interface ProgressSaveResponse {
  episode_id: number;
  position_seconds: number;
  completed: boolean;
}

export interface ProgressGetResponse {
  episode_id: number;
  position_seconds: number;
  duration_seconds: number;
  completed: boolean;
  last_watched_at: string | null;
}

export interface ProgressCompleteResponse {
  episode_id: number;
  franchise_key: string;
  next_episode_id: number | null;
  franchise_completed: boolean;
}

/** Mirrors `SettingsPayload` in src/animedy_v1/interfaces/api.ts. */
export interface SettingsPayload {
  volume: number;
  playback_speed: number;
  subtitle_lang: string;
  preferred_quality: string;
  autoplay: boolean;
  auto_next: boolean;
  auto_skip_intro: boolean;
  auto_skip_outro: boolean;
  auto_fullscreen: boolean;
  countdown_seconds: number;
  metadata_source: MetadataSource;
  skip_source: SkipSource;
  // Frontend-only — not part of the backend SettingsPayload, never synced
  // to /api/settings (this store is local-only, see settings.svelte.ts).
  notify_episode_updates: boolean;
  notify_discovery: boolean;
}

export interface SettingsGetResponse {
  settings: SettingsPayload;
}

export type SettingsSaveRequest = Partial<SettingsPayload>;

export interface SettingsSaveResponse {
  settings: SettingsPayload;
}

/** Mirrors `HistoryListItem` in src/animedy_v1/interfaces/api.ts. */
export interface HistoryListItem {
  episode_id: number;
  anime_id: number;
  title_romaji: string | null;
  title_english: string | null;
  episode_number: number;
  episode_title: string | null;
  completed: boolean;
  last_watched_at: string;
}

export interface HistoryCompletedCount {
  anime_id: number;
  completed_episodes: number;
}

export interface HistoryListResponse {
  items: HistoryListItem[];
  total: number;
  completed_counts: HistoryCompletedCount[];
}
