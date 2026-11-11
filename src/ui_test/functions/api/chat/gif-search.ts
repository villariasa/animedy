import type { PagesFunction } from "../_lib/types";
import { fail } from "../_lib/http";
import { requireAuth } from "../_lib/auth";

// See CHAT_GIF_SEARCH_SETUP.md for how to get a Tenor API key.
const TENOR_BASE = "https://tenor.googleapis.com/v2";
const RESULT_LIMIT = 24;

// Per-user rate limit — this proxies to a metered third-party API, so it
// needs its own throttle independent of the chat send/upload limits.
const SEARCH_WINDOW_MS = 1_000;
const lastSearchAtByUser = new Map<number, number>();

interface TenorMediaFormat {
  url: string;
  dims: [number, number];
}

interface TenorResult {
  id: string;
  media_formats: Record<string, TenorMediaFormat>;
}

interface TenorResponse {
  results: TenorResult[];
}

export interface GifResult {
  id: string;
  url: string;
  preview_url: string;
  width: number;
  height: number;
}

function toGifResult(item: TenorResult): GifResult | null {
  const full = item.media_formats.gif ?? item.media_formats.mediumgif;
  const preview = item.media_formats.tinygif ?? item.media_formats.nanogif ?? full;
  if (!full || !preview) return null;
  return {
    id: item.id,
    url: full.url,
    preview_url: preview.url,
    width: full.dims[0],
    height: full.dims[1],
  };
}

/** GIF search for the chat composer's GIF picker — signed-in only (this
 * proxies a metered third-party API key, so it must not be public). */
export const onRequestGet: PagesFunction = async (context) => {
  const auth = await requireAuth(context);
  if ("response" in auth) return auth.response;

  const userId = auth.claims.user_id;
  const lastAt = lastSearchAtByUser.get(userId) ?? 0;
  if (Date.now() - lastAt < SEARCH_WINDOW_MS) {
    return fail("Searching too fast", 429);
  }
  lastSearchAtByUser.set(userId, Date.now());

  const apiKey = context.env.TENOR_API_KEY;
  if (!apiKey) {
    return fail("GIF search is not configured", 503);
  }

  const query = new URL(context.request.url).searchParams.get("q")?.trim() ?? "";
  const endpoint = query
    ? `${TENOR_BASE}/search?q=${encodeURIComponent(query)}&key=${apiKey}&limit=${RESULT_LIMIT}&media_filter=gif,tinygif,nanogif&contentfilter=medium`
    : `${TENOR_BASE}/featured?key=${apiKey}&limit=${RESULT_LIMIT}&media_filter=gif,tinygif,nanogif&contentfilter=medium`;

  let tenorRes: Response;
  try {
    tenorRes = await fetch(endpoint);
  } catch {
    return fail("GIF search is temporarily unavailable", 502);
  }
  if (!tenorRes.ok) {
    return fail("GIF search is temporarily unavailable", 502);
  }

  const data = (await tenorRes.json()) as TenorResponse;
  const results = (data.results ?? [])
    .map(toGifResult)
    .filter((r): r is GifResult => r !== null);

  return Response.json(
    { success: true, http_code: 200, message: "OK", data: { results } },
    { status: 200, headers: { "Cache-Control": "private, max-age=30" } }
  );
};
