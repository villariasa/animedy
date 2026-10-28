// SQL string queries for the `user_settings` table.

export const SELECT_SETTINGS_BY_USER = `
  SELECT user_id, volume, playback_speed, subtitle_lang, preferred_quality,
         autoplay, auto_next, auto_skip_intro, auto_skip_outro, auto_fullscreen,
         countdown_seconds, metadata_source, skip_source, updated_at
  FROM user_settings
  WHERE user_id = ?
  LIMIT 1
`;

export const INSERT_DEFAULT_SETTINGS = `
  INSERT INTO user_settings (user_id)
  VALUES (?)
  ON DUPLICATE KEY UPDATE user_id = user_id
`;

export const UPSERT_SETTINGS = `
  INSERT INTO user_settings (
    user_id, volume, playback_speed, subtitle_lang, preferred_quality,
    autoplay, auto_next, auto_skip_intro, auto_skip_outro, auto_fullscreen,
    countdown_seconds, metadata_source, skip_source
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    volume = VALUES(volume),
    playback_speed = VALUES(playback_speed),
    subtitle_lang = VALUES(subtitle_lang),
    preferred_quality = VALUES(preferred_quality),
    autoplay = VALUES(autoplay),
    auto_next = VALUES(auto_next),
    auto_skip_intro = VALUES(auto_skip_intro),
    auto_skip_outro = VALUES(auto_skip_outro),
    auto_fullscreen = VALUES(auto_fullscreen),
    countdown_seconds = VALUES(countdown_seconds),
    metadata_source = VALUES(metadata_source),
    skip_source = VALUES(skip_source)
`;
