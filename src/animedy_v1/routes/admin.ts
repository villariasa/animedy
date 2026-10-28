import { Hono } from "hono";
import { adminEpisodesUpsertHandler } from "../handlers/admin.js";
import { adminRequired, authRequired } from "../utils/auth.js";

export const adminRoutes = new Hono();

adminRoutes.post("/episodes/upsert", authRequired, adminRequired, adminEpisodesUpsertHandler);
