import { z } from "zod";

export const server4ResolveSchema = z
  .object({
    anime_id: z.number().int().positive(),
    episode_number: z.number().int().positive(),
    titles: z.array(z.string()).optional(),
  })
  .passthrough();

export type Server4ResolveInput = z.infer<typeof server4ResolveSchema>;
