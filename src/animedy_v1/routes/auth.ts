import { Hono } from "hono";
import { loginHandler, meHandler, registerHandler } from "../handlers/auth.js";
import { authRequired } from "../utils/auth.js";

export const authRoutes = new Hono();

authRoutes.post("/register", registerHandler);
authRoutes.post("/login", loginHandler);
authRoutes.post("/me", authRequired, meHandler);
