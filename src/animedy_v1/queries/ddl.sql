-- Animedy v1 — MariaDB DDL
-- Source of truth: PRD.md §4 Data Model
-- Engine: InnoDB, Charset: utf8mb4 / utf8mb4_unicode_ci

SET NAMES utf8mb4;

-- ============================================================
-- 4.1 users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  username VARCHAR(64) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4.2 user_settings (1:1 with users)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_settings (
  user_id BIGINT UNSIGNED NOT NULL,
  volume TINYINT UNSIGNED NOT NULL DEFAULT 100,
  playback_speed DECIMAL(3,2) NOT NULL DEFAULT 1.00,
  subtitle_lang VARCHAR(16) NOT NULL DEFAULT 'en',
  preferred_quality VARCHAR(16) NOT NULL DEFAULT 'auto',
  autoplay TINYINT(1) NOT NULL DEFAULT 1,
  auto_next TINYINT(1) NOT NULL DEFAULT 1,
  auto_skip_intro TINYINT(1) NOT NULL DEFAULT 1,
  auto_skip_outro TINYINT(1) NOT NULL DEFAULT 1,
  auto_fullscreen TINYINT(1) NOT NULL DEFAULT 0,
  countdown_seconds TINYINT UNSIGNED NOT NULL DEFAULT 10,
  metadata_source ENUM('anilist', 'mal') NOT NULL DEFAULT 'anilist',
  skip_source ENUM('aniskip', 'manual') NOT NULL DEFAULT 'aniskip',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_user_settings_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4.3 anime (cached metadata layer)
-- ============================================================
CREATE TABLE IF NOT EXISTS anime (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  anilist_id INT UNSIGNED NULL,
  mal_id INT UNSIGNED NULL,
  title_romaji VARCHAR(512) NULL,
  title_english VARCHAR(512) NULL,
  title_native VARCHAR(512) NULL,
  synonyms JSON NULL,
  format ENUM('TV', 'MOVIE', 'OVA', 'ONA', 'SPECIAL', 'TV_SHORT', 'MUSIC') NULL,
  status ENUM('FINISHED', 'RELEASING', 'NOT_YET_RELEASED', 'CANCELLED', 'HIATUS') NULL,
  season ENUM('WINTER', 'SPRING', 'SUMMER', 'FALL') NULL,
  season_year SMALLINT NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  episode_count SMALLINT UNSIGNED NULL,
  episode_duration SMALLINT UNSIGNED NULL,
  description TEXT NULL,
  cover_image VARCHAR(1024) NULL,
  banner_image VARCHAR(1024) NULL,
  franchise_key VARCHAR(64) NULL,
  sequence_order SMALLINT NULL,
  season_label VARCHAR(128) NULL,
  arc_name VARCHAR(255) NULL,
  metadata_json JSON NULL,
  cached_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_anime_anilist_id (anilist_id),
  KEY idx_anime_mal_id (mal_id),
  KEY idx_anime_franchise_key (franchise_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4.4 anime_relations (cached relation graph)
-- ============================================================
CREATE TABLE IF NOT EXISTS anime_relations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  from_anime_id BIGINT UNSIGNED NOT NULL,
  to_anime_id BIGINT UNSIGNED NOT NULL,
  relation_type ENUM(
    'PREQUEL', 'SEQUEL', 'SIDE_STORY', 'SPIN_OFF', 'ALTERNATIVE',
    'PARENT', 'SAME_UNIVERSE', 'SOURCE', 'ADAPTATION', 'SUMMARY',
    'CHARACTER', 'OTHER'
  ) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_anime_relations (from_anime_id, to_anime_id, relation_type),
  KEY idx_anime_relations_to (to_anime_id),
  CONSTRAINT fk_anime_relations_from FOREIGN KEY (from_anime_id) REFERENCES anime (id) ON DELETE CASCADE,
  CONSTRAINT fk_anime_relations_to FOREIGN KEY (to_anime_id) REFERENCES anime (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4.5 episodes
-- ============================================================
CREATE TABLE IF NOT EXISTS episodes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  anime_id BIGINT UNSIGNED NOT NULL,
  episode_number SMALLINT UNSIGNED NOT NULL,
  title VARCHAR(512) NULL,
  duration_seconds INT UNSIGNED NULL,
  air_date DATE NULL,
  thumbnail VARCHAR(1024) NULL,
  stream_url VARCHAR(1024) NOT NULL,
  subtitles_json JSON NULL,
  qualities_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_episodes_anime_number (anime_id, episode_number),
  CONSTRAINT fk_episodes_anime FOREIGN KEY (anime_id) REFERENCES anime (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4.6 skip_timestamps
-- ============================================================
CREATE TABLE IF NOT EXISTS skip_timestamps (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  episode_id BIGINT UNSIGNED NOT NULL,
  skip_type ENUM('intro', 'outro', 'recap') NOT NULL,
  start_seconds INT UNSIGNED NOT NULL,
  end_seconds INT UNSIGNED NOT NULL,
  source ENUM('aniskip', 'manual') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_skip_timestamps (episode_id, skip_type, source),
  CONSTRAINT fk_skip_timestamps_episode FOREIGN KEY (episode_id) REFERENCES episodes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4.7 watch_progress (resume + cross-device sync)
-- ============================================================
CREATE TABLE IF NOT EXISTS watch_progress (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  episode_id BIGINT UNSIGNED NOT NULL,
  position_seconds INT UNSIGNED NOT NULL DEFAULT 0,
  duration_seconds INT UNSIGNED NOT NULL DEFAULT 0,
  completed TINYINT(1) NOT NULL DEFAULT 0,
  last_watched_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_watch_progress_user_episode (user_id, episode_id),
  KEY idx_watch_progress_last_watched (last_watched_at),
  CONSTRAINT fk_watch_progress_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_watch_progress_episode FOREIGN KEY (episode_id) REFERENCES episodes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4.8 watch_state (current pointer per user+franchise)
-- ============================================================
CREATE TABLE IF NOT EXISTS watch_state (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  franchise_key VARCHAR(64) NOT NULL,
  current_anime_id BIGINT UNSIGNED NULL,
  current_episode_id BIGINT UNSIGNED NULL,
  series_completed TINYINT(1) NOT NULL DEFAULT 0,
  franchise_completed TINYINT(1) NOT NULL DEFAULT 0,
  last_watched_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_watch_state_user_franchise (user_id, franchise_key),
  KEY idx_watch_state_user (user_id),
  KEY idx_watch_state_last_watched (last_watched_at),
  CONSTRAINT fk_watch_state_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_watch_state_anime FOREIGN KEY (current_anime_id) REFERENCES anime (id) ON DELETE SET NULL,
  CONSTRAINT fk_watch_state_episode FOREIGN KEY (current_episode_id) REFERENCES episodes (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
