import type { PagesFunction } from "./_lib/types";
import { ok, fail, readJson } from "./_lib/http";
import { requireAuth } from "./_lib/auth";

const MAX_BODY_CHARS = 500;
const RATE_LIMIT_MS = 2_000;
const PAGE_SIZE = 50;

export interface ChatMessageRow {
  id: number;
  user_id: number;
  username: string;
  avatar_url?: string | null;
  body: string;
  created_at: string;
}

/**
 * Global chat feed — public read. The response is edge-cached for 3 seconds
 * (s-maxage), so however many clients poll, the function and D1 are hit at
 * most ~20×/minute per unique URL; CDN cache hits are free.
 */
export const onRequestGet: PagesFunction = async (context) => {
  const sinceParam = new URL(context.request.url).searchParams.get("since");
  const since = sinceParam !== null ? Number(sinceParam) : null;
  const db = context.env.DB;

  let rows: ChatMessageRow[];
  if (since !== null && Number.isInteger(since) && since >= 0) {
    const result = await db
      .prepare(
        `SELECT id, user_id, username, avatar_url, body, created_at
         FROM chat_messages WHERE deleted = 0 AND id > ?
         ORDER BY id ASC LIMIT 100`
      )
      .bind(since)
      .all<ChatMessageRow>();
    rows = result.results;
  } else {
    const result = await db
      .prepare(
        `SELECT id, user_id, username, avatar_url, body, created_at
         FROM chat_messages WHERE deleted = 0
         ORDER BY id DESC LIMIT ?`
      )
      .bind(PAGE_SIZE)
      .all<ChatMessageRow>();
    rows = result.results.reverse();
  }

  return Response.json(
    {
      success: true,
      http_code: 200,
      message: "Messages retrieved",
      data: { messages: rows, latest_id: rows.length > 0 ? rows[rows.length - 1].id : (since ?? 0) },
    },
    {
      status: 200,
      headers: { "Cache-Control": "public, max-age=0, s-maxage=3" },
    }
  );
};

/** Send a message — signed-in, not muted, 1 message per 2 seconds. */
export const onRequestPost: PagesFunction = async (context) => {
  const auth = await requireAuth(context);
  if ("response" in auth) return auth.response;
  const userId = auth.claims.user_id;
  const db = context.env.DB;

  const bodyJson = await readJson(context.request);
  const text = typeof bodyJson.body === "string" ? bodyJson.body.trim() : "";
  if (!text) return fail("Message is empty", 422);
  if (text.length > MAX_BODY_CHARS) return fail(`Message is too long (max ${MAX_BODY_CHARS} characters)`, 422);

  const mute = await db
    .prepare(`SELECT muted_until FROM chat_mutes WHERE user_id = ?`)
    .bind(userId)
    .first<{ muted_until: string | null }>();
  if (mute && (mute.muted_until === null || Date.parse(mute.muted_until.replace(" ", "T") + "Z") > Date.now())) {
    return fail("You are muted from chat", 403);
  }

  const last = await db
    .prepare(`SELECT created_at FROM chat_messages WHERE user_id = ? ORDER BY id DESC LIMIT 1`)
    .bind(userId)
    .first<{ created_at: string }>();
  if (last && Date.now() - Date.parse(last.created_at.replace(" ", "T") + "Z") < RATE_LIMIT_MS) {
    return fail("You're sending messages too fast", 429);
  }

  const user = await db
    .prepare(`SELECT avatar_url FROM users WHERE id = ?`)
    .bind(userId)
    .first<{ avatar_url: string | null }>();
  const avatarUrl = user?.avatar_url ?? null;

  const insert = await db
    .prepare(`INSERT INTO chat_messages (user_id, username, avatar_url, body) VALUES (?, ?, ?, ?)`)
    .bind(userId, auth.claims.username, avatarUrl, text)
    .run();

  // Opportunistic prune: keep roughly the newest 2000 rows.
  context.waitUntil(
    db
      .prepare(`DELETE FROM chat_messages WHERE id <= (SELECT COALESCE(MAX(id), 0) - 2000 FROM chat_messages)`)
      .run()
  );

  const message: ChatMessageRow = {
    id: insert.meta.last_row_id,
    user_id: userId,
    username: auth.claims.username,
    avatar_url: avatarUrl,
    body: text,
    created_at: new Date().toISOString().slice(0, 19).replace("T", " "),
  };
  return ok({ message }, "Message sent", 201);
};
