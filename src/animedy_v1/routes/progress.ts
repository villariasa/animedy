import { Hono } from "hono";
import { progressCompleteHandler, progressGetHandler, progressSaveHandler } from "../handlers/progress.js";
import { authRequired } from "../utils/auth.js";

export const progressRoutes = new Hono();

progressRoutes.post("/save", authRequired, progressSaveHandler);
progressRoutes.post("/get", authRequired, progressGetHandler);
progressRoutes.post("/complete", authRequired, progressCompleteHandler);
