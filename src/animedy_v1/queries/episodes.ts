// SQL string queries for the `episodes` table.

export const SELECT_EPISODES_BY_ANIME = `
  SELECT id AS episode_id, episode_number, title, duration_seconds, air_date, thumbnail
  FROM episodes
  WHERE anime_id = ?
  ORDER BY episode_number ASC
`;

export const SELECT_EPISODE_BY_ID = `
  SELECT id, anime_id, episode_number, title, duration_seconds, air_date, thumbnail,
         stream_url, subtitles_json, qualities_json, created_at, updated_at
  FROM episodes
  WHERE id = ?
  LIMIT 1
`;

export const SELECT_EPISODE_BY_ANIME_AND_NUMBER = `
  SELECT id, anime_id, episode_number, title, duration_seconds, air_date, thumbnail,
         stream_url, subtitles_json, qualities_json, created_at, updated_at
  FROM episodes
  WHERE anime_id = ? AND episode_number = ?
  LIMIT 1
`;

export const SELECT_NEXT_EPISODE = `
  SELECT id, anime_id, episode_number, title, duration_seconds, air_date, thumbnail,
         stream_url, subtitles_json, qualities_json, created_at, updated_at
  FROM episodes
  WHERE anime_id = ? AND episode_number > ?
  ORDER BY episode_number ASC
  LIMIT 1
`;

export const UPSERT_EPISODE = `
  INSERT INTO episodes (
    anime_id, episode_number, title, duration_seconds, air_date, thumbnail,
    stream_url, subtitles_json, qualities_json
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    title = VALUES(title),
    duration_seconds = VALUES(duration_seconds),
    air_date = VALUES(air_date),
    thumbnail = VALUES(thumbnail),
    stream_url = VALUES(stream_url),
    subtitles_json = VALUES(subtitles_json),
    qualities_json = VALUES(qualities_json)
`;

export const SELECT_EPISODE_COUNT_BY_ANIME = `
  SELECT COUNT(*) AS total
  FROM episodes
  WHERE anime_id = ?
`;
