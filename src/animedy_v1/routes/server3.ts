import { Hono } from "hono";
import { server3ResolveHandler, server3ProxyHandler } from "../handlers/server3.js";
import { optionalAuth } from "../utils/auth.js";

export const server3Routes = new Hono();

server3Routes.post("/resolve", optionalAuth, server3ResolveHandler);
server3Routes.get("/proxy", server3ProxyHandler);
