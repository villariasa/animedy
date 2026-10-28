import { z } from "zod";

const metadataSourceSchema = z.enum(["anilist", "mal"]);

export const animeSearchSchema = z
  .object({
    query: z.string().min(1).max(255),
    metadata_source: metadataSourceSchema.optional(),
  })
  .strict();

export const animeDetailsSchema = z
  .object({
    anime_id: z.number().int().positive().optional(),
    anilist_id: z.number().int().positive().optional(),
  })
  .strict()
  .refine((val) => val.anime_id !== undefined || val.anilist_id !== undefined, {
    message: "anime_id or anilist_id is required",
  });

export const animeFranchiseSchema = z
  .object({
    anime_id: z.number().int().positive().optional(),
    anilist_id: z.number().int().positive().optional(),
  })
  .strict()
  .refine((val) => val.anime_id !== undefined || val.anilist_id !== undefined, {
    message: "anime_id or anilist_id is required",
  });

export const animeRefreshSchema = z
  .object({
    anime_id: z.number().int().positive().optional(),
    anilist_id: z.number().int().positive().optional(),
    metadata_source: metadataSourceSchema.optional(),
  })
  .strict()
  .refine((val) => val.anime_id !== undefined || val.anilist_id !== undefined, {
    message: "anime_id or anilist_id is required",
  });

export type AnimeSearchInput = z.infer<typeof animeSearchSchema>;
export type AnimeDetailsInput = z.infer<typeof animeDetailsSchema>;
export type AnimeFranchiseInput = z.infer<typeof animeFranchiseSchema>;
export type AnimeRefreshInput = z.infer<typeof animeRefreshSchema>;
