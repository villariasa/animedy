import type { Env, PagesFunction } from "./_lib/types";
import { ok, fail, readJson } from "./_lib/http";
import { verifyToken } from "./_lib/auth";
import { asInt, asOptionalString } from "./_lib/validate";

/**
 * Presence heartbeat — called by every client (guests included) every ~60s
 * while the app is open, with watch details while an episode is playing.
 * Keyed by an anonymous per-device id so the admin dashboard can see guest
 * sessions too; a valid Bearer token additionally attaches the account.
 */
export const onRequestPost: PagesFunction = async (context) => {
  const env: Env = context.env;
  const body = await readJson(context.request);

  const clientId = typeof body.client_id === "string" ? body.client_id.slice(0, 64) : "";
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(clientId)) return fail("Invalid client_id", 422);

  let userId: number | null = null;
  let username: string | null = null;
  const header = context.request.headers.get("Authorization");
  if (header?.startsWith("Bearer ") && env.JWT_SECRET) {
    const claims = await verifyToken(header.slice("Bearer ".length).trim(), env.JWT_SECRET);
    if (claims) {
      userId = claims.user_id;
      username = claims.username;
    }
  }

  const page = asOptionalString(body.page, 32) ?? "browse";
  const animeId = asInt(body.anime_id);
  const episodeNumber = asInt(body.episode_number);
  const position = typeof body.position_seconds === "number" ? Math.max(0, Math.round(body.position_seconds)) : null;

  await env.DB.prepare(
    `INSERT INTO user_activity
       (client_id, user_id, username, page, anime_id, episode_number, position_seconds, title, cover_image, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT (client_id) DO UPDATE SET
       user_id = excluded.user_id,
       username = excluded.username,
       page = excluded.page,
       anime_id = excluded.anime_id,
       episode_number = excluded.episode_number,
       position_seconds = excluded.position_seconds,
       title = excluded.title,
       cover_image = excluded.cover_image,
       updated_at = CURRENT_TIMESTAMP`
  )
    .bind(
      clientId,
      userId,
      username,
      page,
      animeId,
      episodeNumber,
      position,
      asOptionalString(body.title, 512),
      asOptionalString(body.cover_image, 1024)
    )
    .run();

  return ok({ client_id: clientId }, "Heartbeat recorded", 200);
};
