import type { Context } from "hono";
import { query } from "../../lib/dbconn.js";
import { logError } from "../../lib/errorlogger.js";
import { ok, fail } from "../lib/response.js";
import { hashPassword, verifyPassword, signToken, getClaims } from "../utils/auth.js";
import { authLoginSchema, authRegisterSchema } from "../schemas/auth.js";
import {
  INSERT_USER,
  SELECT_USER_BY_EMAIL,
  SELECT_USER_BY_ID,
  SELECT_USER_BY_USERNAME,
} from "../queries/users.js";
import { INSERT_DEFAULT_SETTINGS, SELECT_SETTINGS_BY_USER } from "../queries/settings.js";
import type { UserRow, UserSettingsRow } from "../interfaces/db.js";
import type {
  AuthUserProfile,
  AuthRegisterResponse,
  AuthLoginResponse,
  AuthMeResponse,
} from "../interfaces/api.js";

function toProfile(user: UserRow): AuthUserProfile {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    created_at: user.created_at,
  };
}

export async function registerHandler(context: Context): Promise<Response> {
  try {
    const parsed = authRegisterSchema.safeParse(await context.req.json().catch(() => ({})));
    if (!parsed.success) {
      return context.json(fail("Invalid request body", 422), 422);
    }
    const { email, username, password } = parsed.data;

    const existingByEmail = await query<UserRow[]>(SELECT_USER_BY_EMAIL, [email]);
    if (existingByEmail.length > 0) {
      return context.json(fail("Email already registered", 409), 409);
    }
    const existingByUsername = await query<UserRow[]>(SELECT_USER_BY_USERNAME, [username]);
    if (existingByUsername.length > 0) {
      return context.json(fail("Username already taken", 409), 409);
    }

    const passwordHash = await hashPassword(password);
    const insertResult = await query<{ insertId: number }>(INSERT_USER, [email, username, passwordHash]);
    const userId = insertResult.insertId;

    await query(INSERT_DEFAULT_SETTINGS, [userId]);

    const [user] = await query<UserRow[]>(SELECT_USER_BY_ID, [userId]);
    if (!user) {
      return context.json(fail("Failed to create user", 500), 500);
    }

    const token = signToken({ user_id: user.id, username: user.username, role: user.role });
    const responseData: AuthRegisterResponse = { user: toProfile(user), token };
    return context.json(ok(responseData, "User registered", 201), 201);
  } catch (err) {
    await logError("auth.register", err);
    return context.json(fail("Internal server error", 500), 500);
  }
}

export async function loginHandler(context: Context): Promise<Response> {
  try {
    const parsed = authLoginSchema.safeParse(await context.req.json().catch(() => ({})));
    if (!parsed.success) {
      return context.json(fail("Invalid request body", 422), 422);
    }
    const { email, password } = parsed.data;

    const [user] = await query<UserRow[]>(SELECT_USER_BY_EMAIL, [email]);
    if (!user) {
      return context.json(fail("Invalid email or password", 401), 401);
    }

    const passwordMatches = await verifyPassword(password, user.password_hash);
    if (!passwordMatches) {
      return context.json(fail("Invalid email or password", 401), 401);
    }

    const token = signToken({ user_id: user.id, username: user.username, role: user.role });
    const responseData: AuthLoginResponse = { user: toProfile(user), token };
    return context.json(ok(responseData, "Login successful"), 200);
  } catch (err) {
    await logError("auth.login", err);
    return context.json(fail("Internal server error", 500), 500);
  }
}

export async function meHandler(context: Context): Promise<Response> {
  try {
    const claims = getClaims(context);
    const [user] = await query<UserRow[]>(SELECT_USER_BY_ID, [claims.user_id]);
    if (!user) {
      return context.json(fail("User not found", 404), 404);
    }
    const settingsRows = await query<UserSettingsRow[]>(SELECT_SETTINGS_BY_USER, [user.id]);
    const responseData: AuthMeResponse = { user: toProfile(user), has_settings: settingsRows.length > 0 };
    return context.json(ok(responseData, "Profile retrieved"), 200);
  } catch (err) {
    await logError("auth.me", err);
    return context.json(fail("Internal server error", 500), 500);
  }
}
