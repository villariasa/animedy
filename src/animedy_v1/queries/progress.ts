// SQL string queries for `watch_progress` and `watch_state` tables,
// incl. the Continue Watching join and watch_state advance logic.

export const UPSERT_WATCH_PROGRESS = `
  INSERT INTO watch_progress (
    user_id, episode_id, position_seconds, duration_seconds, completed, last_watched_at
  )
  VALUES (?, ?, ?, ?, ?, NOW())
  ON DUPLICATE KEY UPDATE
    position_seconds = VALUES(position_seconds),
    duration_seconds = VALUES(duration_seconds),
    completed = VALUES(completed),
    last_watched_at = NOW()
`;

export const SELECT_WATCH_PROGRESS = `
  SELECT id, user_id, episode_id, position_seconds, duration_seconds, completed,
         last_watched_at, created_at
  FROM watch_progress
  WHERE user_id = ? AND episode_id = ?
  LIMIT 1
`;

// -------------------- watch_state --------------------

export const SELECT_WATCH_STATE_BY_USER_AND_FRANCHISE = `
  SELECT id, user_id, franchise_key, current_anime_id, current_episode_id,
         series_completed, franchise_completed, last_watched_at, created_at
  FROM watch_state
  WHERE user_id = ? AND franchise_key = ?
  LIMIT 1
`;

export const UPSERT_WATCH_STATE = `
  INSERT INTO watch_state (
    user_id, franchise_key, current_anime_id, current_episode_id,
    series_completed, franchise_completed, last_watched_at
  )
  VALUES (?, ?, ?, ?, ?, ?, NOW())
  ON DUPLICATE KEY UPDATE
    current_anime_id = VALUES(current_anime_id),
    current_episode_id = VALUES(current_episode_id),
    series_completed = VALUES(series_completed),
    franchise_completed = VALUES(franchise_completed),
    last_watched_at = NOW()
`;

export const SELECT_CONTINUE_WATCHING_LIST = `
  SELECT ws.franchise_key, ws.current_anime_id AS anime_id, a.title_romaji,
         a.title_english, a.season_label, ws.current_episode_id AS episode_id,
         e.episode_number, wp.position_seconds, wp.duration_seconds,
         ws.last_watched_at
  FROM watch_state ws
  INNER JOIN anime a ON a.id = ws.current_anime_id
  INNER JOIN episodes e ON e.id = ws.current_episode_id
  LEFT JOIN watch_progress wp ON wp.user_id = ws.user_id AND wp.episode_id = ws.current_episode_id
  WHERE ws.user_id = ? AND ws.franchise_completed = 0
  ORDER BY ws.last_watched_at DESC
`;
