import type { Context } from "hono";
import { query } from "../../lib/dbconn.js";
import { logError } from "../../lib/errorlogger.js";
import { ok, fail } from "../lib/response.js";
import { getClaims } from "../utils/auth.js";
import { settingsSaveSchema } from "../schemas/settings.js";
import { INSERT_DEFAULT_SETTINGS, SELECT_SETTINGS_BY_USER, UPSERT_SETTINGS } from "../queries/settings.js";
import type { UserSettingsRow } from "../interfaces/db.js";
import type { SettingsGetResponse, SettingsPayload, SettingsSaveResponse } from "../interfaces/api.js";

function toPayload(row: UserSettingsRow): SettingsPayload {
  return {
    volume: row.volume,
    playback_speed: Number(row.playback_speed),
    subtitle_lang: row.subtitle_lang,
    preferred_quality: row.preferred_quality,
    autoplay: row.autoplay === 1,
    auto_next: row.auto_next === 1,
    auto_skip_intro: row.auto_skip_intro === 1,
    auto_skip_outro: row.auto_skip_outro === 1,
    auto_fullscreen: row.auto_fullscreen === 1,
    countdown_seconds: row.countdown_seconds,
    metadata_source: row.metadata_source,
    skip_source: row.skip_source,
  };
}

export async function settingsGetHandler(context: Context): Promise<Response> {
  try {
    const claims = getClaims(context);
    let rows = await query<UserSettingsRow[]>(SELECT_SETTINGS_BY_USER, [claims.user_id]);
    if (rows.length === 0) {
      await query(INSERT_DEFAULT_SETTINGS, [claims.user_id]);
      rows = await query<UserSettingsRow[]>(SELECT_SETTINGS_BY_USER, [claims.user_id]);
    }
    const [settingsRow] = rows;
    if (!settingsRow) {
      return context.json(fail("Unable to load settings", 500), 500);
    }
    const responseData: SettingsGetResponse = { settings: toPayload(settingsRow) };
    return context.json(ok(responseData, "Settings retrieved"), 200);
  } catch (err) {
    await logError("settings.get", err);
    return context.json(fail("Internal server error", 500), 500);
  }
}

export async function settingsSaveHandler(context: Context): Promise<Response> {
  try {
    const claims = getClaims(context);
    const parsed = settingsSaveSchema.safeParse(await context.req.json().catch(() => ({})));
    if (!parsed.success) {
      return context.json(fail("Invalid request body", 422), 422);
    }

    let rows = await query<UserSettingsRow[]>(SELECT_SETTINGS_BY_USER, [claims.user_id]);
    if (rows.length === 0) {
      await query(INSERT_DEFAULT_SETTINGS, [claims.user_id]);
      rows = await query<UserSettingsRow[]>(SELECT_SETTINGS_BY_USER, [claims.user_id]);
    }
    const [current] = rows;
    if (!current) {
      return context.json(fail("Unable to load settings", 500), 500);
    }

    const merged: UserSettingsRow = {
      ...current,
      ...(parsed.data.volume !== undefined ? { volume: parsed.data.volume } : {}),
      ...(parsed.data.playback_speed !== undefined
        ? { playback_speed: String(parsed.data.playback_speed) }
        : {}),
      ...(parsed.data.subtitle_lang !== undefined ? { subtitle_lang: parsed.data.subtitle_lang } : {}),
      ...(parsed.data.preferred_quality !== undefined
        ? { preferred_quality: parsed.data.preferred_quality }
        : {}),
      ...(parsed.data.autoplay !== undefined ? { autoplay: parsed.data.autoplay ? 1 : 0 } : {}),
      ...(parsed.data.auto_next !== undefined ? { auto_next: parsed.data.auto_next ? 1 : 0 } : {}),
      ...(parsed.data.auto_skip_intro !== undefined
        ? { auto_skip_intro: parsed.data.auto_skip_intro ? 1 : 0 }
        : {}),
      ...(parsed.data.auto_skip_outro !== undefined
        ? { auto_skip_outro: parsed.data.auto_skip_outro ? 1 : 0 }
        : {}),
      ...(parsed.data.auto_fullscreen !== undefined
        ? { auto_fullscreen: parsed.data.auto_fullscreen ? 1 : 0 }
        : {}),
      ...(parsed.data.countdown_seconds !== undefined
        ? { countdown_seconds: parsed.data.countdown_seconds }
        : {}),
      ...(parsed.data.metadata_source !== undefined
        ? { metadata_source: parsed.data.metadata_source }
        : {}),
      ...(parsed.data.skip_source !== undefined ? { skip_source: parsed.data.skip_source } : {}),
    };

    await query(UPSERT_SETTINGS, [
      claims.user_id,
      merged.volume,
      merged.playback_speed,
      merged.subtitle_lang,
      merged.preferred_quality,
      merged.autoplay,
      merged.auto_next,
      merged.auto_skip_intro,
      merged.auto_skip_outro,
      merged.auto_fullscreen,
      merged.countdown_seconds,
      merged.metadata_source,
      merged.skip_source,
    ]);

    const responseData: SettingsSaveResponse = { settings: toPayload(merged) };
    return context.json(ok(responseData, "Settings saved"), 200);
  } catch (err) {
    await logError("settings.save", err);
    return context.json(fail("Internal server error", 500), 500);
  }
}
