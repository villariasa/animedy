import { z } from "zod";

export const episodesListSchema = z
  .object({
    anime_id: z.number().int().positive(),
  })
  .strict();

export const episodesSourcesSchema = z
  .object({
    episode_id: z.number().int().positive(),
  })
  .strict();

export type EpisodesListInput = z.infer<typeof episodesListSchema>;
export type EpisodesSourcesInput = z.infer<typeof episodesSourcesSchema>;
