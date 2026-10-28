import { Hono } from "hono";
import { skipGetHandler, skipSetHandler } from "../handlers/skip.js";
import { authRequired, optionalAuth } from "../utils/auth.js";

export const skipRoutes = new Hono();

skipRoutes.post("/get", optionalAuth, skipGetHandler);
skipRoutes.post("/set", authRequired, skipSetHandler);
