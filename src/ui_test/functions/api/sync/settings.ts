import type { PagesFunction } from "../_lib/types";
import { ok, fail, readJson } from "../_lib/http";
import { requireAuth } from "../_lib/auth";

// Whitelisted user_settings columns and how to coerce incoming values.
const BOOL_COLS = ["autoplay", "auto_next", "auto_skip_intro", "auto_skip_outro", "auto_fullscreen"];
const INT_COLS: Record<string, [number, number]> = {
  volume: [0, 100],
  countdown_seconds: [0, 60],
};
const TEXT_COLS: Record<string, Set<string> | null> = {
  subtitle_lang: null,
  preferred_quality: null,
  metadata_source: new Set(["anilist", "mal"]),
  skip_source: new Set(["aniskip", "manual"]),
};

export const onRequestGet: PagesFunction = async (context) => {
  const auth = await requireAuth(context);
  if ("response" in auth) return auth.response;
  const db = context.env.DB;
  await db.prepare(`INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)`)
    .bind(auth.claims.user_id)
    .run();
  const row = await db.prepare(`SELECT * FROM user_settings WHERE user_id = ?`)
    .bind(auth.claims.user_id)
    .first();
  return ok({ settings: row }, "Settings retrieved", 200);
};

export const onRequestPut: PagesFunction = async (context) => {
  const auth = await requireAuth(context);
  if ("response" in auth) return auth.response;
  const body = await readJson(context.request);

  const sets: string[] = [];
  const values: unknown[] = [];

  for (const col of BOOL_COLS) {
    if (typeof body[col] === "boolean") {
      sets.push(`${col} = ?`);
      values.push(body[col] ? 1 : 0);
    }
  }
  for (const [col, [min, max]] of Object.entries(INT_COLS)) {
    const v = body[col];
    if (typeof v === "number" && Number.isFinite(v)) {
      sets.push(`${col} = ?`);
      values.push(Math.min(max, Math.max(min, Math.round(v))));
    }
  }
  if (typeof body.playback_speed === "number" && body.playback_speed > 0 && body.playback_speed <= 4) {
    sets.push(`playback_speed = ?`);
    values.push(body.playback_speed);
  }
  for (const [col, allowed] of Object.entries(TEXT_COLS)) {
    const v = body[col];
    if (typeof v === "string" && v.length <= 16 && (!allowed || allowed.has(v))) {
      sets.push(`${col} = ?`);
      values.push(v);
    }
  }

  if (sets.length === 0) return fail("No valid settings fields in body", 422);

  const db = context.env.DB;
  await db.prepare(`INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)`)
    .bind(auth.claims.user_id)
    .run();
  await db
    .prepare(`UPDATE user_settings SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`)
    .bind(...values, auth.claims.user_id)
    .run();
  const row = await db.prepare(`SELECT * FROM user_settings WHERE user_id = ?`)
    .bind(auth.claims.user_id)
    .first();
  return ok({ settings: row }, "Settings saved", 200);
};
