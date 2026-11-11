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
  attachment_url?: string | null;
  attachment_type?: string | null;
  created_at: string;
  is_muted?: number | null;
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
        `SELECT id, user_id, username, avatar_url, body, attachment_url, attachment_type, created_at,
                (SELECT 1 FROM chat_mutes cm WHERE cm.user_id = chat_messages.user_id AND (cm.muted_until IS NULL OR cm.muted_until > datetime('now'))) AS is_muted
         FROM chat_messages WHERE deleted = 0 AND id > ?
         ORDER BY id ASC LIMIT 100`
      )
      .bind(since)
      .all<ChatMessageRow>();
    rows = result.results;
  } else {
    const result = await db
      .prepare(
        `SELECT id, user_id, username, avatar_url, body, attachment_url, attachment_type, created_at,
                (SELECT 1 FROM chat_mutes cm WHERE cm.user_id = chat_messages.user_id AND (cm.muted_until IS NULL OR cm.muted_until > datetime('now'))) AS is_muted
         FROM chat_messages WHERE deleted = 0
         ORDER BY id DESC LIMIT ?`
      )
      .bind(PAGE_SIZE)
      .all<ChatMessageRow>();
    rows = result.results.reverse();
  }

  // Who's typing right now (pings land via POST /api/chat/typing).
  const typing = await db
    .prepare(
      `SELECT username FROM chat_typing WHERE updated_at >= datetime('now', '-6 seconds') LIMIT 5`
    )
    .all<{ username: string }>();

  return Response.json(
    {
      success: true,
      http_code: 200,
      message: "Messages retrieved",
      data: {
        messages: rows,
        latest_id: rows.length > 0 ? rows[rows.length - 1].id : (since ?? 0),
        typing: typing.results.map((t) => t.username),
      },
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
  const attachmentUrl = typeof bodyJson.attachment_url === "string" ? bodyJson.attachment_url : "";
  const attachmentType = typeof bodyJson.attachment_type === "string" ? bodyJson.attachment_type : "";

  if (!text && !attachmentUrl) return fail("Message is empty", 422);
  if (text.length > MAX_BODY_CHARS) return fail(`Message is too long (max ${MAX_BODY_CHARS} characters)`, 422);
  // The attachment must be one this user just uploaded via POST /api/chat/upload
  // (that endpoint keys objects as chat/<userId>/...) — prevents attaching
  // someone else's or an arbitrary external URL.
  if (attachmentUrl && !attachmentUrl.startsWith(`/api/chat/media/chat/${userId}/`)) {
    return fail("Invalid attachment", 422);
  }

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
    .prepare(
      `INSERT INTO chat_messages (user_id, username, avatar_url, body, attachment_url, attachment_type)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(userId, auth.claims.username, avatarUrl, text, attachmentUrl || null, attachmentType || null)
    .run();

  // Opportunistic prune + clear the sender's typing flag (they just sent).
  context.waitUntil(
    db.batch([
      db.prepare(`DELETE FROM chat_messages WHERE id <= (SELECT COALESCE(MAX(id), 0) - 2000 FROM chat_messages)`),
      db.prepare(`DELETE FROM chat_typing WHERE user_id = ? OR updated_at < datetime('now', '-60 seconds')`).bind(userId),
    ])
  );

  const message: ChatMessageRow = {
    id: insert.meta.last_row_id,
    user_id: userId,
    username: auth.claims.username,
    avatar_url: avatarUrl,
    body: text,
    attachment_url: attachmentUrl || null,
    attachment_type: attachmentType || null,
    created_at: new Date().toISOString().slice(0, 19).replace("T", " "),
  };
  return ok({ message }, "Message sent", 201);
};
