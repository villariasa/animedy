import { Hono } from "hono";
import { server2PlayerHandler } from "../handlers/server2.js";

export const server2Routes = new Hono();

server2Routes.get("/player", server2PlayerHandler);

