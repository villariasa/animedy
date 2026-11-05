import type { PagesFunction } from "../_lib/types";
import { ok, fail, readJson } from "../_lib/http";
import { requireAdmin } from "../_lib/auth";
import { notifyEveryone } from "../_lib/push";

/** Save an announcement and push it to every subscribed device. */
export const onRequestPost: PagesFunction = async (context) => {
  const auth = await requireAdmin(context);
  if ("response" in auth) return auth.response;

  const body = await readJson(context.request);
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 100) : "";
  const text = typeof body.body === "string" ? body.body.trim().slice(0, 500) : "";
  if (!title || !text) return fail("Title and message are required", 422);

  const db = context.env.DB;
  const insert = await db
    .prepare(`INSERT INTO announcements (admin_id, title, body) VALUES (?, ?, ?)`)
    .bind(auth.claims.user_id, title, text)
    .run();

  context.waitUntil(notifyEveryone(context.env, db));

  return ok({ id: insert.meta.last_row_id, title }, "Announcement sent to all subscribed devices", 201);
};
