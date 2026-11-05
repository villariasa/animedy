import type { PagesFunction } from "../_lib/types";
import { ok } from "../_lib/http";
import { requireAuth } from "../_lib/auth";

/** "I'm typing" ping — upserts a timestamp per user. The chat feed (GET
 * /api/chat) reports users with a ping in the last 6 seconds. The client
 * throttles these to one every ~2.5s while keys are pressed. */
export const onRequestPost: PagesFunction = async (context) => {
  const auth = await requireAuth(context);
  if ("response" in auth) return auth.response;

  await context.env.DB.prepare(
    `INSERT INTO chat_typing (user_id, username, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id) DO UPDATE SET
       username = excluded.username, updated_at = CURRENT_TIMESTAMP`
  )
    .bind(auth.claims.user_id, auth.claims.username)
    .run();

  return ok({ typing: true }, "Noted", 200);
};
