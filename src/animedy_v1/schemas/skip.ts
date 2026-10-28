import { z } from "zod";

const skipSourceSchema = z.enum(["aniskip", "manual"]);
const skipTypeSchema = z.enum(["intro", "outro", "recap"]);

export const skipGetSchema = z
  .object({
    episode_id: z.number().int().positive(),
    skip_source: skipSourceSchema.optional(),
  })
  .strict();

export const skipSetSchema = z
  .object({
    episode_id: z.number().int().positive(),
    skip_type: skipTypeSchema,
    start_seconds: z.number().int().nonnegative(),
    end_seconds: z.number().int().nonnegative(),
  })
  .strict()
  .refine((val) => val.end_seconds > val.start_seconds, {
    message: "end_seconds must be greater than start_seconds",
  });

export type SkipGetInput = z.infer<typeof skipGetSchema>;
export type SkipSetInput = z.infer<typeof skipSetSchema>;
