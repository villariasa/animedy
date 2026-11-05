import type { PagesFunction } from "../_lib/types";
import { ok } from "../_lib/http";
import { requireAuth } from "../_lib/auth";
import { fetchCloudState } from "../_lib/data";

/** Full cloud state in one request — the client calls this after login to
 * hydrate likes / lists / watch status / settings on a new device. */
export const onRequestGet: PagesFunction = async (context) => {
  const auth = await requireAuth(context);
  if ("response" in auth) return auth.response;
  const state = await fetchCloudState(context.env.DB, auth.claims.user_id);
  return ok(state, "Cloud state retrieved", 200);
};
