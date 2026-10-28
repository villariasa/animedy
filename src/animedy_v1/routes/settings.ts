import { Hono } from "hono";
import { settingsGetHandler, settingsSaveHandler } from "../handlers/settings.js";
import { authRequired } from "../utils/auth.js";

export const settingsRoutes = new Hono();

settingsRoutes.post("/get", authRequired, settingsGetHandler);
settingsRoutes.post("/save", authRequired, settingsSaveHandler);
