import type { PagesFunction } from "../_lib/types";
import { ok, fail, readJson } from "../_lib/http";
import { verifyToken } from "../_lib/auth";

const DEFAULT_BASE_LOVE_COUNT = 1342;

async function getLoveState(
  db: PagesFunction extends (...args: any[]) => any ? any : any,
  clientId?: string | null,
  userId?: number | null
): Promise<{ count: number; loved: boolean }> {
  const baseRow = await db
    .prepare("SELECT base_count FROM site_counters WHERE name = 'site_love'")
    .first<{ base_count: number }>();
  const baseCount = baseRow?.base_count ?? DEFAULT_BASE_LOVE_COUNT;

  const countRow = await db
    .prepare("SELECT COUNT(*) AS count FROM site_reactions WHERE reaction = 'love'")
    .first<{ count: number }>();
  const total = baseCount + (countRow?.count ?? 0);

  let loved = false;
  if (userId) {
    const row = await db
      .prepare(
        "SELECT id FROM site_reactions WHERE reaction = 'love' AND (user_id = ? OR client_id = ?) LIMIT 1"
      )
      .bind(userId, clientId || "")
      .first();
    loved = Boolean(row);
  } else if (clientId) {
    const row = await db
      .prepare("SELECT id FROM site_reactions WHERE reaction = 'love' AND client_id = ? LIMIT 1")
      .bind(clientId)
      .first();
    loved = Boolean(row);
  }

  return { count: total, loved };
}

/**
 * Public GET: retrieve current love count (starting from 1342) and whether
 * this guest or user has loved the site.
 */
export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const clientId = url.searchParams.get("client_id");

  let userId: number | null = null;
  const header = context.request.headers.get("Authorization");
  if (header?.startsWith("Bearer ") && context.env.JWT_SECRET) {
    const claims = await verifyToken(header.slice("Bearer ".length).trim(), context.env.JWT_SECRET);
    if (claims) userId = claims.user_id;
  }

  const state = await getLoveState(context.env.DB, clientId, userId);
  return ok(state);
};

/**
 * Public POST: toggle or set love status for a guest or user.
 * Body: { client_id: string, action?: "love" | "unlove" | "toggle" }
 */
export const onRequestPost: PagesFunction = async (context) => {
  const body = await readJson(context.request);

  const clientId = typeof body.client_id === "string" ? body.client_id.trim().slice(0, 64) : "";
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(clientId)) {
    return fail("Invalid client_id", 422);
  }

  let userId: number | null = null;
  const header = context.request.headers.get("Authorization");
  if (header?.startsWith("Bearer ") && context.env.JWT_SECRET) {
    const claims = await verifyToken(header.slice("Bearer ".length).trim(), context.env.JWT_SECRET);
    if (claims) userId = claims.user_id;
  }

  const existing = await context.env.DB
    .prepare(
      "SELECT id FROM site_reactions WHERE reaction = 'love' AND (client_id = ? OR (user_id IS NOT NULL AND user_id = ?)) LIMIT 1"
    )
    .bind(clientId, userId ?? -1)
    .first<{ id: number }>();

  const action = body.action || "toggle";
  let shouldLove = !existing;
  if (action === "love") shouldLove = true;
  else if (action === "unlove") shouldLove = false;

  if (shouldLove) {
    await context.env.DB
      .prepare(
        `INSERT INTO site_reactions (client_id, user_id, reaction)
         VALUES (?, ?, 'love')
         ON CONFLICT (client_id, reaction)
         DO UPDATE SET user_id = COALESCE(excluded.user_id, site_reactions.user_id)`
      )
      .bind(clientId, userId)
      .run();
  } else {
    await context.env.DB
      .prepare(
        "DELETE FROM site_reactions WHERE reaction = 'love' AND (client_id = ? OR (user_id IS NOT NULL AND user_id = ?))"
      )
      .bind(clientId, userId ?? -1)
      .run();
  }

  const state = await getLoveState(context.env.DB, clientId, userId);
  return ok(state, shouldLove ? "Loved Animedy!" : "Unloved");
};
