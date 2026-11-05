import type { PagesFunction } from "../_lib/types";

/** Latest announcement — public. The service worker fetches this when a push
 * wakes it to decide what notification text to show. Tiny edge cache keeps a
 * push fan-out to thousands of devices from stampeding D1. */
export const onRequestGet: PagesFunction = async (context) => {
  const row = await context.env.DB.prepare(
    `SELECT id, title, body, created_at FROM announcements ORDER BY id DESC LIMIT 1`
  ).first();

  return Response.json(
    { success: true, http_code: 200, message: "Latest announcement", data: { announcement: row ?? null } },
    { status: 200, headers: { "Cache-Control": "public, max-age=0, s-maxage=5" } }
  );
};
