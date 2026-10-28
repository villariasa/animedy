import { Hono } from "hono";
import { episodesListHandler, episodesSourcesHandler } from "../handlers/episodes.js";
import { optionalAuth } from "../utils/auth.js";

export const episodesRoutes = new Hono();

episodesRoutes.post("/list", optionalAuth, episodesListHandler);
episodesRoutes.post("/sources", optionalAuth, episodesSourcesHandler);
