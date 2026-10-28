// SQL string queries powering /api/history/list.

export const SELECT_HISTORY_LIST = `
  SELECT wp.episode_id, e.anime_id, a.title_romaji, a.title_english,
         e.episode_number, e.title AS episode_title, wp.completed, wp.last_watched_at
  FROM watch_progress wp
  INNER JOIN episodes e ON e.id = wp.episode_id
  INNER JOIN anime a ON a.id = e.anime_id
  WHERE wp.user_id = ?
  ORDER BY wp.last_watched_at DESC
  LIMIT ? OFFSET ?
`;

export const SELECT_HISTORY_COUNT = `
  SELECT COUNT(*) AS total
  FROM watch_progress
  WHERE user_id = ?
`;

export const SELECT_HISTORY_COMPLETED_COUNTS = `
  SELECT e.anime_id, COUNT(*) AS completed_episodes
  FROM watch_progress wp
  INNER JOIN episodes e ON e.id = wp.episode_id
  WHERE wp.user_id = ? AND wp.completed = 1
  GROUP BY e.anime_id
`;
