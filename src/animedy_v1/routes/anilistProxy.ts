import { Hono } from "hono";
import { logError } from "../../lib/errorlogger.js";

// Server-side proxy for the AniList GraphQL API. The frontend used to call
// https://graphql.anilist.co directly from every browser on every page load
// (no cache, no timeout) — any AniList slowness/rate-limit/outage surfaced
// straight to users as a hung UI or "Failed to fetch". Routing through here
// makes the browser's request same-origin and fast, and the in-memory cache
// means concurrent visitors share one upstream call instead of each paying
// for their own.
const ANILIST_URL = "https://graphql.anilist.co";
const CACHE_TTL_MS = 90_000;
const UPSTREAM_TIMEOUT_MS = 10_000;

interface CacheEntry {
  expiresAt: number;
  body: unknown;
}

const cache = new Map<string, CacheEntry>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const anilistProxyRoutes = new Hono();

anilistProxyRoutes.post("/graphql", async (context) => {
  const body = (await context.req.json().catch(() => null)) as {
    query?: string;
    variables?: Record<string, unknown>;
  } | null;

  if (!body || typeof body.query !== "string") {
    return context.json({ errors: [{ message: "Invalid request body" }] }, 422);
  }

  const variables = body.variables ?? {};
  const cacheKey = JSON.stringify({ q: body.query, v: variables });
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return context.json(cached.body, 200);
  }

  const doFetch = () =>
    fetch(ANILIST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: body.query, variables }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
    });

  try {
    let upstream = await doFetch();

    if (upstream.status === 429) {
      const retryAfter = Number(upstream.headers.get("Retry-After"));
      if (Number.isFinite(retryAfter) && retryAfter > 0 && retryAfter <= 5) {
        await sleep(retryAfter * 1000);
        upstream = await doFetch();
      }
    }

    const json = await upstream.json().catch(() => null);
    if (upstream.ok && json) {
      cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, body: json });
    }

    const headers: Record<string, string> = {};
    const retryAfterHeader = upstream.headers.get("Retry-After");
    if (retryAfterHeader) headers["Retry-After"] = retryAfterHeader;

    return context.json(json ?? { errors: [{ message: "Upstream returned an invalid response" }] }, upstream.status as 200, headers);
  } catch (err) {
    await logError("anilist.proxy", err);
    return context.json({ errors: [{ message: "AniList upstream unreachable" }] }, 502);
  }
});
