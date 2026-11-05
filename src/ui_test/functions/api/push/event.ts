import type { PagesFunction } from "../_lib/types";

/** Most recent admin-event TYPE (no content) — the service worker fetches
 * this when a payload-less push wakes it, to pick notification wording.
 * Deliberately content-free: it only says "feedback" or "reset" happened
 * recently, which is safe to expose publicly. */
export const onRequestGet: PagesFunction = async (context) => {
  const db = context.env.DB;

  const [feedback, reset] = await db.batch<{ at: string }>([
    db.prepare(`SELECT created_at AS at FROM feedback ORDER BY id DESC LIMIT 1`),
    db.prepare(
      `SELECT requested_at AS at FROM password_resets WHERE status = 'pending' ORDER BY requested_at DESC LIMIT 1`
    ),
  ]);

  const toMs = (at: string | undefined): number =>
    at ? Date.parse(at.includes("T") ? at : at.replace(" ", "T") + "Z") : 0;

  const feedbackAt = toMs(feedback.results[0]?.at);
  const resetAt = toMs(reset.results[0]?.at);
  const freshMs = 5 * 60 * 1000;
  const now = Date.now();

  let type: "feedback" | "reset" | null = null;
  if (feedbackAt > resetAt && now - feedbackAt < freshMs) type = "feedback";
  else if (resetAt > 0 && now - resetAt < freshMs) type = "reset";

  return Response.json(
    { success: true, http_code: 200, message: "Latest event", data: { type } },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
};
