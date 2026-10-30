import { z } from "zod";

export const server3ResolveSchema = z
  .object({
    anime_id: z.number().int().positive(),
    episode_number: z.number().int().positive(),
  })
  .strict();

export type Server3ResolveInput = z.infer<typeof server3ResolveSchema>;
