// Shapes for external API payloads: AniList (GraphQL), Jikan (REST), AniSkip (REST).
// See PRD.md §6 External API Handling.

// -------------------- AniList --------------------

export interface AniListTitle {
  romaji: string | null;
  english: string | null;
  native: string | null;
}

export interface AniListFuzzyDate {
  year: number | null;
  month: number | null;
  day: number | null;
}

export interface AniListCoverImage {
  extraLarge: string | null;
  large: string | null;
  medium: string | null;
}

export type AniListRelationType =
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

export interface AniListRelationEdge {
  relationType: AniListRelationType;
  node: AniListMedia;
}

export interface AniListMedia {
  id: number;
  idMal: number | null;
  title: AniListTitle;
  synonyms: string[];
  format: string | null;
  status: string | null;
  season: string | null;
  seasonYear: number | null;
  startDate: AniListFuzzyDate;
  endDate: AniListFuzzyDate;
  episodes: number | null;
  duration: number | null;
  description: string | null;
  coverImage: AniListCoverImage;
  bannerImage: string | null;
  relations?: {
    edges: AniListRelationEdge[];
  };
}

export interface AniListSearchResponse {
  data: {
    Page: {
      media: AniListMedia[];
    };
  };
}

export interface AniListMediaResponse {
  data: {
    Media: AniListMedia;
  };
}

// -------------------- Jikan (MyAnimeList) --------------------

export interface JikanTitleEntry {
  type: string;
  title: string;
}

export interface JikanImages {
  jpg: { image_url: string | null; large_image_url: string | null };
}

export interface JikanAiredProp {
  from: string | null;
  to: string | null;
}

export interface JikanAnimeData {
  mal_id: number;
  titles: JikanTitleEntry[];
  type: string | null;
  status: string | null;
  episodes: number | null;
  duration: string | null;
  season: string | null;
  year: number | null;
  aired: { prop: { from: JikanAiredProp; to: JikanAiredProp }; from: string | null; to: string | null };
  synopsis: string | null;
  images: JikanImages;
}

export interface JikanSearchResponse {
  data: JikanAnimeData[];
}

export interface JikanAnimeDetailsResponse {
  data: JikanAnimeData;
}

// -------------------- AniSkip --------------------

export interface AniSkipInterval {
  start_time: number;
  end_time: number;
}

export type AniSkipType = "op" | "ed" | "recap" | "mixed-op" | "mixed-ed";

export interface AniSkipResult {
  interval: AniSkipInterval;
  skip_type: AniSkipType;
  skip_id: string;
  episode_length: number;
}

export interface AniSkipResponse {
  found: boolean;
  results: AniSkipResult[];
  message?: string;
}
