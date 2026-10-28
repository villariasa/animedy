import { Hono } from "hono";
import { historyListHandler } from "../handlers/history.js";
import { authRequired } from "../utils/auth.js";

export const historyRoutes = new Hono();

historyRoutes.post("/list", authRequired, historyListHandler);
