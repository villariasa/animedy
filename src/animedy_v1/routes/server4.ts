import { Hono } from "hono";
import { server4ResolveHandler, server4PlayerHandler } from "../handlers/server4.js";
import { optionalAuth } from "../utils/auth.js";

export const server4Routes = new Hono();

server4Routes.post("/resolve", optionalAuth, server4ResolveHandler);
server4Routes.get("/player", server4PlayerHandler);
