import { z } from "zod";

export const authRegisterSchema = z
  .object({
    email: z.string().email(),
    username: z.string().min(3).max(64),
    password: z.string().min(8).max(128),
  })
  .strict();

export const authLoginSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
  })
  .strict();

export const authMeSchema = z.object({}).strict();

export type AuthRegisterInput = z.infer<typeof authRegisterSchema>;
export type AuthLoginInput = z.infer<typeof authLoginSchema>;
export type AuthMeInput = z.infer<typeof authMeSchema>;
