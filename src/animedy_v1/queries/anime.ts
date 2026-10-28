// SQL string queries for `anime` and `anime_relations` tables, incl. franchise ordering.

export const SELECT_ANIME_BY_ID = `
  SELECT id, anilist_id, mal_id, title_romaji, title_english, title_native, synonyms,
         format, status, season, season_year, start_date, end_date, episode_count,
         episode_duration, description, cover_image, banner_image, franchise_key,
         sequence_order, season_label, arc_name, metadata_json, cached_at,
         created_at, updated_at
  FROM anime
  WHERE id = ?
  LIMIT 1
`;

export const SELECT_ANIME_BY_ANILIST_ID = `
  SELECT id, anilist_id, mal_id, title_romaji, title_english, title_native, synonyms,
         format, status, season, season_year, start_date, end_date, episode_count,
         episode_duration, description, cover_image, banner_image, franchise_key,
         sequence_order, season_label, arc_name, metadata_json, cached_at,
         created_at, updated_at
  FROM anime
  WHERE anilist_id = ?
  LIMIT 1
`;

export const SELECT_ANIME_BY_MAL_ID = `
  SELECT id, anilist_id, mal_id, title_romaji, title_english, title_native, synonyms,
         format, status, season, season_year, start_date, end_date, episode_count,
         episode_duration, description, cover_image, banner_image, franchise_key,
         sequence_order, season_label, arc_name, metadata_json, cached_at,
         created_at, updated_at
  FROM anime
  WHERE mal_id = ?
  LIMIT 1
`;

export const SEARCH_ANIME_BY_TITLE = `
  SELECT id, anilist_id, mal_id, title_romaji, title_english, cover_image, format,
         status, season_year
  FROM anime
  WHERE title_romaji LIKE CONCAT('%', ?, '%')
     OR title_english LIKE CONCAT('%', ?, '%')
     OR title_native LIKE CONCAT('%', ?, '%')
  ORDER BY season_year DESC
  LIMIT 50
`;

export const INSERT_ANIME = `
  INSERT INTO anime (
    anilist_id, mal_id, title_romaji, title_english, title_native, synonyms,
    format, status, season, season_year, start_date, end_date, episode_count,
    episode_duration, description, cover_image, banner_image, franchise_key,
    sequence_order, season_label, arc_name, metadata_json, cached_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    mal_id = VALUES(mal_id),
    title_romaji = VALUES(title_romaji),
    title_english = VALUES(title_english),
    title_native = VALUES(title_native),
    synonyms = VALUES(synonyms),
    format = VALUES(format),
    status = VALUES(status),
    season = VALUES(season),
    season_year = VALUES(season_year),
    start_date = VALUES(start_date),
    end_date = VALUES(end_date),
    episode_count = VALUES(episode_count),
    episode_duration = VALUES(episode_duration),
    description = VALUES(description),
    cover_image = VALUES(cover_image),
    banner_image = VALUES(banner_image),
    franchise_key = VALUES(franchise_key),
    sequence_order = VALUES(sequence_order),
    season_label = VALUES(season_label),
    arc_name = VALUES(arc_name),
    metadata_json = VALUES(metadata_json),
    cached_at = VALUES(cached_at)
`;

export const UPDATE_ANIME_FRANCHISE_ORDER = `
  UPDATE anime
  SET franchise_key = ?, sequence_order = ?, season_label = ?, arc_name = ?
  WHERE id = ?
`;

export const SELECT_FRANCHISE_ENTRIES = `
  SELECT id AS anime_id, anilist_id, title_romaji, title_english, format,
         season_label, arc_name, sequence_order, episode_count, start_date
  FROM anime
  WHERE franchise_key = ?
  ORDER BY sequence_order ASC, start_date ASC
`;

export const INSERT_ANIME_RELATION = `
  INSERT INTO anime_relations (from_anime_id, to_anime_id, relation_type)
  VALUES (?, ?, ?)
  ON DUPLICATE KEY UPDATE relation_type = relation_type
`;

export const SELECT_RELATIONS_FROM_ANIME = `
  SELECT id, from_anime_id, to_anime_id, relation_type, created_at
  FROM anime_relations
  WHERE from_anime_id = ?
`;

export const SELECT_RELATIONS_TO_ANIME = `
  SELECT id, from_anime_id, to_anime_id, relation_type, created_at
  FROM anime_relations
  WHERE to_anime_id = ?
`;
