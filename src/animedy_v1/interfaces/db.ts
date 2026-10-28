// TypeScript interfaces mirroring every table in queries/ddl.sql.
// Column names/types must stay in exact sync with the DDL.

export type UserRole = "user" | "admin";

export interface UserRow {
  id: number;
  email: string;
  username: string;
  password_hash: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export type MetadataSource = "anilist" | "mal";
export type SkipSource = "aniskip" | "manual";

export interface UserSettingsRow {
  user_id: number;
  volume: number;
  playback_speed: string;
  subtitle_lang: string;
  preferred_quality: string;
  autoplay: 0 | 1;
  auto_next: 0 | 1;
  auto_skip_intro: 0 | 1;
  auto_skip_outro: 0 | 1;
  auto_fullscreen: 0 | 1;
  countdown_seconds: number;
  metadata_source: MetadataSource;
  skip_source: SkipSource;
  updated_at: string;
}

export type AnimeFormat = "TV" | "MOVIE" | "OVA" | "ONA" | "SPECIAL" | "TV_SHORT" | "MUSIC";
export type AnimeStatus = "FINISHED" | "RELEASING" | "NOT_YET_RELEASED" | "CANCELLED" | "HIATUS";
export type AnimeSeason = "WINTER" | "SPRING" | "SUMMER" | "FALL";

export interface AnimeRow {
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
  metadata_json: Record<string, unknown> | null;
  cached_at: string | null;
  created_at: string;
  updated_at: string;
}

export type RelationType =
  | "PREQUEL"
  | "SEQUEL"
  | "SIDE_STORY"
  | "SPIN_OFF"
  | "ALTERNATIVE"
  | "PARENT"
  | "SAME_UNIVERSE"
  | "SOURCE"
  | "ADAPTATION"
  | "SUMMARY"
  | "CHARACTER"
  | "OTHER";

export interface AnimeRelationRow {
  id: number;
  from_anime_id: number;
  to_anime_id: number;
  relation_type: RelationType;
  created_at: string;
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

export interface EpisodeRow {
  id: number;
  anime_id: number;
  episode_number: number;
  title: string | null;
  duration_seconds: number | null;
  air_date: string | null;
  thumbnail: string | null;
  stream_url: string;
  subtitles_json: SubtitleTrack[] | null;
  qualities_json: QualityVariant[] | null;
  created_at: string;
  updated_at: string;
}

export type SkipType = "intro" | "outro" | "recap";

export interface SkipTimestampRow {
  id: number;
  episode_id: number;
  skip_type: SkipType;
  start_seconds: number;
  end_seconds: number;
  source: SkipSource;
  created_at: string;
  updated_at: string;
}

export interface WatchProgressRow {
  id: number;
  user_id: number;
  episode_id: number;
  position_seconds: number;
  duration_seconds: number;
  completed: 0 | 1;
  last_watched_at: string;
  created_at: string;
}

export interface WatchStateRow {
  id: number;
  user_id: number;
  franchise_key: string;
  current_anime_id: number | null;
  current_episode_id: number | null;
  series_completed: 0 | 1;
  franchise_completed: 0 | 1;
  last_watched_at: string;
  created_at: string;
}
