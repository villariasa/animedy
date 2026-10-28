import type { Context } from "hono";
import { logError } from "../../lib/errorlogger.js";
import { ok, fail } from "../lib/response.js";
import { getClaims } from "../utils/auth.js";
import { watchNextGetSchema } from "../schemas/progress.js";
import { getAnimeRowById } from "../utils/metadata.js";
import { computeWatchNext } from "../utils/watchnext.js";

export async function watchNextGetHandler(context: Context): Promise<Response> {
  try {
    const claims = getClaims(context);
    const parsed = watchNextGetSchema.safeParse(await context.req.json().catch(() => ({})));
    if (!parsed.success) {
      return context.json(fail("Invalid request body", 422), 422);
    }

    let franchiseKey = parsed.data.franchise_key;
    if (!franchiseKey && parsed.data.anime_id !== undefined) {
      const anime = await getAnimeRowById(parsed.data.anime_id);
      if (!anime) {
        return context.json(fail("Anime not found", 404), 404);
      }
      franchiseKey = anime.franchise_key ?? String(anime.id);
    }
    if (!franchiseKey) {
      return context.json(fail("franchise_key or anime_id is required", 422), 422);
    }

    const result = await computeWatchNext(claims.user_id, franchiseKey);
    return context.json(ok(result, "Watch next computed"), 200);
  } catch (err) {
    await logError("watchNext.get", err);
    return context.json(fail("Internal server error", 500), 500);
  }
}
