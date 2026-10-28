import { z } from "zod";

const metadataSourceSchema = z.enum(["anilist", "mal"]);
const skipSourceSchema = z.enum(["aniskip", "manual"]);

export const settingsGetSchema = z.object({}).strict();

export const settingsSaveSchema = z
  .object({
    volume: z.number().int().min(0).max(100).optional(),
    playback_speed: z.number().min(0.25).max(4).optional(),
    subtitle_lang: z.string().min(2).max(16).optional(),
    preferred_quality: z.string().min(2).max(16).optional(),
    autoplay: z.boolean().optional(),
    auto_next: z.boolean().optional(),
    auto_skip_intro: z.boolean().optional(),
    auto_skip_outro: z.boolean().optional(),
    auto_fullscreen: z.boolean().optional(),
    countdown_seconds: z.number().int().min(0).max(60).optional(),
    metadata_source: metadataSourceSchema.optional(),
    skip_source: skipSourceSchema.optional(),
  })
  .strict();

export type SettingsGetInput = z.infer<typeof settingsGetSchema>;
export type SettingsSaveInput = z.infer<typeof settingsSaveSchema>;
