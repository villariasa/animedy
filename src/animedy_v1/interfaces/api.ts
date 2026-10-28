// Standard API envelope + request/response payload interfaces for all 20 endpoints.
// See PRD.md §5 for the endpoint catalogue.

import type {
  AnimeFormat,
  AnimeRow,
  AnimeStatus,
  MetadataSource,
  QualityVariant,
  SkipSource,
  SkipType,
  SubtitleTrack,
  UserRole,
} from "./db.js";

export interface ApiResponse<T> {
  success: boolean;
  http_code: number;
  message: string;
  data: T | null;
}

// -------------------- Auth --------------------

export interface AuthRegisterRequest {
  email: string;
  username: string;
  password: string;
}

export interface AuthLoginRequest {
  email: string;
  password: string;
}

export type AuthMeRequest = Record<string, never>;

export interface AuthUserProfile {
  id: number;
  email: string;
  username: string;
  role: UserRole;
  created_at: string;
}

export interface AuthRegisterResponse {
  user: AuthUserProfile;
  token: string;
}

export interface AuthLoginResponse {
  user: AuthUserProfile;
  token: string;
}

export interface AuthMeResponse {
  user: AuthUserProfile;
  has_settings: boolean;
}

// -------------------- Anime & metadata --------------------

export interface AnimeSearchRequest {
  query: string;
  metadata_source?: MetadataSource;
}

export interface AnimeSearchResultItem {
  anime_id: number;
  anilist_id: number | null;
  mal_id: number | null;
  title_romaji: string | null;
  title_english: string | null;
  cover_image: string | null;
  format: AnimeFormat | null;
  status: AnimeStatus | null;
  season_year: number | null;
}

export interface AnimeSearchResponse {
  results: AnimeSearchResultItem[];
}

export interface AnimeDetailsRequest {
  anime_id?: number;
  anilist_id?: number;
}

export interface AnimeDetailsResponse {
  anime: AnimeRow;
}

export interface AnimeFranchiseRequest {
  anime_id?: number;
  anilist_id?: number;
}

export interface FranchiseEntry {
  anime_id: number;
  anilist_id: number | null;
  title_romaji: string | null;
  title_english: string | null;
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

export interface AnimeRefreshRequest {
  anime_id?: number;
  anilist_id?: number;
  metadata_source?: MetadataSource;
}

export interface AnimeRefreshResponse {
  anime: AnimeRow;
}

// -------------------- Episodes --------------------

export interface EpisodesListRequest {
  anime_id: number;
}

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

export interface EpisodesSourcesRequest {
  episode_id: number;
}

export interface EpisodesSourcesResponse {
  episode_id: number;
  stream_url: string;
  subtitles: SubtitleTrack[];
  qualities: QualityVariant[];
}

// -------------------- Skip data --------------------

export interface SkipGetRequest {
  episode_id: number;
  skip_source?: SkipSource;
}

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

export interface SkipSetRequest {
  episode_id: number;
  skip_type: SkipType;
  start_seconds: number;
  end_seconds: number;
}

export interface SkipSetResponse {
  episode_id: number;
  skip_type: SkipType;
  start_seconds: number;
  end_seconds: number;
  source: "manual";
}

// -------------------- Progress, history & continuation --------------------

export interface ProgressSaveRequest {
  episode_id: number;
  position_seconds: number;
  duration_seconds: number;
}

export interface ProgressSaveResponse {
  episode_id: number;
  position_seconds: number;
  completed: boolean;
}

export interface ProgressGetRequest {
  episode_id: number;
}

export interface ProgressGetResponse {
  episode_id: number;
  position_seconds: number;
  duration_seconds: number;
  completed: boolean;
  last_watched_at: string | null;
}

export interface ProgressCompleteRequest {
  episode_id: number;
}

export interface ProgressCompleteResponse {
  episode_id: number;
  franchise_key: string;
  next_episode_id: number | null;
  franchise_completed: boolean;
}

export type ContinueWatchingListRequest = Record<string, never>;

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

export interface WatchNextGetRequest {
  franchise_key?: string;
  anime_id?: number;
}

export type WatchNextReason =
  | "NEXT_EPISODE"
  | "NEXT_SEASON"
  | "SEQUEL"
  | "MOVIE"
  | "SPECIAL_OR_OVA"
  | "FRANCHISE_RECOMMENDATION"
  | "NONE";

export interface WatchNextGetResponse {
  reason: WatchNextReason;
  anime_id: number | null;
  episode_id: number | null;
  title_romaji: string | null;
  title_english: string | null;
}

export interface HistoryListRequest {
  limit?: number;
  offset?: number;
}

export interface HistoryListItem {
  episode_id: number;
  anime_id: number;
  title_romaji: string | null;
  title_english: string | null;
  episode_number: number;
  completed: boolean;
  last_watched_at: string;
}

export interface HistoryListResponse {
  items: HistoryListItem[];
  total: number;
}

// -------------------- Settings --------------------

export type SettingsGetRequest = Record<string, never>;

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
}

export interface SettingsGetResponse {
  settings: SettingsPayload;
}

export type SettingsSaveRequest = Partial<SettingsPayload>;

export interface SettingsSaveResponse {
  settings: SettingsPayload;
}

// -------------------- Admin --------------------

export interface AdminEpisodeUpsertItem {
  anime_id: number;
  episode_number: number;
  title?: string;
  duration_seconds?: number;
  air_date?: string;
  thumbnail?: string;
  stream_url: string;
  subtitles?: SubtitleTrack[];
  qualities?: QualityVariant[];
}

// Accepts a single episode or a bulk array for operator convenience.
export interface AdminEpisodeUpsertRequest {
  episodes: AdminEpisodeUpsertItem[];
}

export interface AdminEpisodeUpsertResponse {
  episode_ids: number[];
}
