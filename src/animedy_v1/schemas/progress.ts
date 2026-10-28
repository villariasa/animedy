import { z } from "zod";

export const progressSaveSchema = z
  .object({
    episode_id: z.number().int().positive(),
    position_seconds: z.number().int().nonnegative(),
    duration_seconds: z.number().int().nonnegative(),
  })
  .strict();

export const progressGetSchema = z
  .object({
    episode_id: z.number().int().positive(),
  })
  .strict();

export const progressCompleteSchema = z
  .object({
    episode_id: z.number().int().positive(),
  })
  .strict();

export const continueWatchingListSchema = z.object({}).strict();

export const watchNextGetSchema = z
  .object({
    franchise_key: z.string().min(1).max(64).optional(),
    anime_id: z.number().int().positive().optional(),
  })
  .strict()
  .refine((val) => val.franchise_key !== undefined || val.anime_id !== undefined, {
    message: "franchise_key or anime_id is required",
  });

export const historyListSchema = z
  .object({
    limit: z.number().int().positive().max(200).optional(),
    offset: z.number().int().nonnegative().optional(),
  })
  .strict();

export type ProgressSaveInput = z.infer<typeof progressSaveSchema>;
export type ProgressGetInput = z.infer<typeof progressGetSchema>;
export type ProgressCompleteInput = z.infer<typeof progressCompleteSchema>;
export type ContinueWatchingListInput = z.infer<typeof continueWatchingListSchema>;
export type WatchNextGetInput = z.infer<typeof watchNextGetSchema>;
export type HistoryListInput = z.infer<typeof historyListSchema>;
