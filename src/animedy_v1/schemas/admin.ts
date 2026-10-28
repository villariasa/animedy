import { z } from "zod";

const subtitleTrackSchema = z
  .object({
    lang: z.string().min(2).max(16),
    label: z.string().min(1).max(64),
    url: z.string().url(),
  })
  .strict();

const qualityVariantSchema = z
  .object({
    label: z.string().min(1).max(32),
    url: z.string().url(),
  })
  .strict();

export const adminEpisodesUpsertSchema = z
  .object({
    anime_id: z.number().int().positive(),
    episode_number: z.number().int().positive(),
    title: z.string().max(512).optional(),
    duration_seconds: z.number().int().positive().optional(),
    air_date: z.string().date().optional(),
    thumbnail: z.string().url().optional(),
    stream_url: z.string().url(),
    subtitles: z.array(subtitleTrackSchema).optional(),
    qualities: z.array(qualityVariantSchema).optional(),
  })
  .strict();

export type AdminEpisodesUpsertInput = z.infer<typeof adminEpisodesUpsertSchema>;
