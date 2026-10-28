import { Hono } from "hono";
import {
  animeDetailsHandler,
  animeFranchiseHandler,
  animeRefreshHandler,
  animeSearchHandler,
} from "../handlers/anime.js";
import { authRequired, optionalAuth } from "../utils/auth.js";

export const animeRoutes = new Hono();

animeRoutes.post("/search", optionalAuth, animeSearchHandler);
animeRoutes.post("/details", optionalAuth, animeDetailsHandler);
animeRoutes.post("/franchise", optionalAuth, animeFranchiseHandler);
animeRoutes.post("/refresh", authRequired, animeRefreshHandler);
