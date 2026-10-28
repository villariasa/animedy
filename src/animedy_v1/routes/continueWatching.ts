import { Hono } from "hono";
import { continueWatchingListHandler } from "../handlers/continueWatching.js";
import { authRequired } from "../utils/auth.js";

export const continueWatchingRoutes = new Hono();

continueWatchingRoutes.post("/list", authRequired, continueWatchingListHandler);
