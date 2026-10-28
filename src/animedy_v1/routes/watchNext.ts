import { Hono } from "hono";
import { watchNextGetHandler } from "../handlers/watchNext.js";
import { authRequired } from "../utils/auth.js";

export const watchNextRoutes = new Hono();

watchNextRoutes.post("/get", authRequired, watchNextGetHandler);
