import { apiPost, ApiError } from "$lib/api/client";
import { getCached, putCached } from "$lib/db/local";

/**
 * POST with IndexedDB offline fallback: on success the response is cached
 * under `route + body`; when the network is unreachable the cached copy is
 * served instead (stale-while-offline, PRD §7 — API is POST-only so the
 * service worker can't cache it).
 */
export async function apiPostCached<T>(route: string, body: object = {}): Promise<T> {
  const key = `${route}:${JSON.stringify(body)}`;
  let result: T;
  try {
    result = await apiPost<T>(route, body);
    await putCached(key, result).catch(() => undefined);
  } catch (err) {
    const offline = err instanceof ApiError && err.httpCode === 0;
    const cached = offline ? await getCached<T>(key).catch(() => undefined) : undefined;
    if (cached === undefined) {
      throw err;
    }
    result = cached;
  }
  return result;
}
