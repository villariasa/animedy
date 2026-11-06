-- Animedy v1 — Cloudflare D1 (SQLite) Schema
-- Includes base platform tables + PLAN_USER_ACCOUNTS.md cross-device sync tables

PRAGMA foreign_keys = ON;

-- ============================================================
-- 1. users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 2. user_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS user_settings (
  user_id INTEGER PRIMARY KEY,
  volume INTEGER NOT NULL DEFAULT 100,
  playback_speed REAL NOT NULL DEFAULT 1.00,
  subtitle_lang TEXT NOT NULL DEFAULT 'en',
  preferred_quality TEXT NOT NULL DEFAULT 'auto',
  autoplay INTEGER NOT NULL DEFAULT 1,
  auto_next INTEGER NOT NULL DEFAULT 1,
  auto_skip_intro INTEGER NOT NULL DEFAULT 1,
  auto_skip_outro INTEGER NOT NULL DEFAULT 1,
  auto_fullscreen INTEGER NOT NULL DEFAULT 0,
  countdown_seconds INTEGER NOT NULL DEFAULT 10,
  metadata_source TEXT NOT NULL DEFAULT 'anilist' CHECK (metadata_source IN ('anilist', 'mal')),
  skip_source TEXT NOT NULL DEFAULT 'aniskip' CHECK (skip_source IN ('aniskip', 'manual')),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- ============================================================
-- 3. anime
-- ============================================================
CREATE TABLE IF NOT EXISTS anime (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anilist_id INTEGER UNIQUE,
  mal_id INTEGER,
  title_romaji TEXT,
  title_english TEXT,
  title_native TEXT,
  synonyms TEXT,
  format TEXT,
  status TEXT,
  season TEXT,
  season_year INTEGER,
  start_date TEXT,
  end_date TEXT,
  episode_count INTEGER,
  episode_duration INTEGER,
  description TEXT,
  cover_image TEXT,
  banner_image TEXT,
  franchise_key TEXT,
  sequence_order INTEGER,
  season_label TEXT,
  arc_name TEXT,
  metadata_json TEXT,
  cached_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_anime_mal_id ON anime (mal_id);
CREATE INDEX IF NOT EXISTS idx_anime_franchise_key ON anime (franchise_key);

-- ============================================================
-- 4. anime_relations
-- ============================================================
CREATE TABLE IF NOT EXISTS anime_relations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_anime_id INTEGER NOT NULL,
  to_anime_id INTEGER NOT NULL,
  relation_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (from_anime_id, to_anime_id, relation_type),
  FOREIGN KEY (from_anime_id) REFERENCES anime (id) ON DELETE CASCADE,
  FOREIGN KEY (to_anime_id) REFERENCES anime (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_anime_relations_to ON anime_relations (to_anime_id);

-- ============================================================
-- 5. episodes
-- ============================================================
CREATE TABLE IF NOT EXISTS episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anime_id INTEGER NOT NULL,
  episode_number INTEGER NOT NULL,
  title TEXT,
  duration_seconds INTEGER,
  air_date TEXT,
  thumbnail TEXT,
  stream_url TEXT NOT NULL,
  subtitles_json TEXT,
  qualities_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (anime_id, episode_number),
  FOREIGN KEY (anime_id) REFERENCES anime (id) ON DELETE CASCADE
);

-- ============================================================
-- 6. skip_timestamps
-- ============================================================
CREATE TABLE IF NOT EXISTS skip_timestamps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  episode_id INTEGER NOT NULL,
  skip_type TEXT NOT NULL CHECK (skip_type IN ('intro', 'outro', 'recap')),
  start_seconds INTEGER NOT NULL,
  end_seconds INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('aniskip', 'manual')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (episode_id, skip_type, source),
  FOREIGN KEY (episode_id) REFERENCES episodes (id) ON DELETE CASCADE
);

-- ============================================================
-- 7. watch_progress
-- ============================================================
CREATE TABLE IF NOT EXISTS watch_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  episode_id INTEGER NOT NULL,
  position_seconds INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  last_watched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, episode_id),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (episode_id) REFERENCES episodes (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_watch_progress_last_watched ON watch_progress (last_watched_at);

-- ============================================================
-- 8. watch_state
-- ============================================================
CREATE TABLE IF NOT EXISTS watch_state (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  franchise_key TEXT NOT NULL,
  current_anime_id INTEGER,
  current_episode_id INTEGER,
  series_completed INTEGER NOT NULL DEFAULT 0,
  franchise_completed INTEGER NOT NULL DEFAULT 0,
  last_watched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, franchise_key),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (current_anime_id) REFERENCES anime (id) ON DELETE SET NULL,
  FOREIGN KEY (current_episode_id) REFERENCES episodes (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_watch_state_user ON watch_state (user_id);
CREATE INDEX IF NOT EXISTS idx_watch_state_last_watched ON watch_state (last_watched_at);

-- ============================================================
-- 9. liked_anime (PLAN_USER_ACCOUNTS.md §3)
-- ============================================================
CREATE TABLE IF NOT EXISTS liked_anime (
  user_id INTEGER NOT NULL,
  anime_id INTEGER NOT NULL,
  liked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, anime_id),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (anime_id) REFERENCES anime (id) ON DELETE CASCADE
);

-- ============================================================
-- 10. custom_lists (PLAN_USER_ACCOUNTS.md §3)
-- ============================================================
CREATE TABLE IF NOT EXISTS custom_lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_custom_lists_user ON custom_lists (user_id);

-- ============================================================
-- 11. custom_list_entries (PLAN_USER_ACCOUNTS.md §3)
-- ============================================================
CREATE TABLE IF NOT EXISTS custom_list_entries (
  list_id INTEGER NOT NULL,
  anime_id INTEGER NOT NULL,
  added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (list_id, anime_id),
  FOREIGN KEY (list_id) REFERENCES custom_lists (id) ON DELETE CASCADE,
  FOREIGN KEY (anime_id) REFERENCES anime (id) ON DELETE CASCADE
);

-- ============================================================
-- 12. watch_status (PLAN_USER_ACCOUNTS.md §3)
-- ============================================================
CREATE TABLE IF NOT EXISTS watch_status (
  user_id INTEGER NOT NULL,
  anime_id INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('watching', 'completed', 'plan_to_watch', 'dropped')),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, anime_id),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (anime_id) REFERENCES anime (id) ON DELETE CASCADE
);

-- ============================================================
-- 13. user_activity (admin presence/monitoring heartbeat)
--     One row per device/browser session (guests included).
-- ============================================================
CREATE TABLE IF NOT EXISTS user_activity (
  client_id TEXT PRIMARY KEY,
  user_id INTEGER,
  username TEXT,
  page TEXT,
  anime_id INTEGER,
  episode_number INTEGER,
  position_seconds INTEGER,
  title TEXT,
  cover_image TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_activity_updated ON user_activity (updated_at);
CREATE INDEX IF NOT EXISTS idx_user_activity_user ON user_activity (user_id);

-- ============================================================
-- 14. chat_messages (PLAN_GLOBAL_CHAT.md — global live chat)
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  avatar_url TEXT,
  body TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages (created_at);

-- ============================================================
-- 15. chat_mutes (PLAN_GLOBAL_CHAT.md — chat moderation)
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_mutes (
  user_id INTEGER PRIMARY KEY,
  reason TEXT,
  muted_by INTEGER NOT NULL,
  muted_until TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- ============================================================
-- 16. password_resets (admin-approved password reset flow)
--     One active request per user; secret_hash ties the reset to
--     the device that requested it.
-- ============================================================
CREATE TABLE IF NOT EXISTS password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  secret_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- ============================================================
-- 17. push_subscriptions (Web Push — admin alerts even when the
--     PWA is closed)
-- ============================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions (user_id);

-- ============================================================
-- 18. announcements (PLAN_ANNOUNCEMENTS.md — admin push announcements)
-- ============================================================
CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users (id) ON DELETE CASCADE
);

-- ============================================================
-- 19. chat_typing (global chat "X is typing…" indicator)
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_typing (
  user_id INTEGER PRIMARY KEY,
  username TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- ============================================================
-- 20. feedback (PLAN_FEEDBACK.md — admin-only feedback inbox,
--     guests welcome under a random device nickname)
-- ============================================================
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  nickname TEXT NOT NULL,
  client_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback (created_at);

-- ============================================================
-- 21. site_counters & site_reactions (Site Love Count & Reactions)
--     1342 initial base count record; guests & users can love/toggle.
-- ============================================================
CREATE TABLE IF NOT EXISTS site_counters (
  name TEXT PRIMARY KEY,
  base_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO site_counters (name, base_count) VALUES ('site_love', 1342);

CREATE TABLE IF NOT EXISTS site_reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT NOT NULL,
  user_id INTEGER,
  reaction TEXT NOT NULL DEFAULT 'love',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (client_id, reaction),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_site_reactions_reaction ON site_reactions (reaction);
CREATE INDEX IF NOT EXISTS idx_site_reactions_user ON site_reactions (user_id);


-- ============================================================
-- 21. watch_history (cross-device episode progress sync)
--     Keyed by AniList anime id + episode number (streams come from
--     embed providers, so there are no server-side episode rows).
--     last_watched_at is normalized to 'YYYY-MM-DD HH:MM:SS' and acts
--     as the last-write-wins conflict clock across devices.
-- ============================================================
CREATE TABLE IF NOT EXISTS watch_history (
  user_id INTEGER NOT NULL,
  anime_id INTEGER NOT NULL,
  episode_number INTEGER NOT NULL,
  position_seconds INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  episode_title TEXT,
  last_watched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now')),
  PRIMARY KEY (user_id, anime_id, episode_number),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (anime_id) REFERENCES anime (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_watch_history_user_time ON watch_history (user_id, last_watched_at);
