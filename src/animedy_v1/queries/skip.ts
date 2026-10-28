// SQL string queries for the `skip_timestamps` table.

export const SELECT_SKIP_SEGMENTS_BY_EPISODE = `
  SELECT id, episode_id, skip_type, start_seconds, end_seconds, source,
         created_at, updated_at
  FROM skip_timestamps
  WHERE episode_id = ?
`;

export const SELECT_SKIP_SEGMENTS_BY_EPISODE_AND_SOURCE = `
  SELECT id, episode_id, skip_type, start_seconds, end_seconds, source,
         created_at, updated_at
  FROM skip_timestamps
  WHERE episode_id = ? AND source = ?
`;

export const UPSERT_SKIP_SEGMENT = `
  INSERT INTO skip_timestamps (episode_id, skip_type, start_seconds, end_seconds, source)
  VALUES (?, ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    start_seconds = VALUES(start_seconds),
    end_seconds = VALUES(end_seconds)
`;
