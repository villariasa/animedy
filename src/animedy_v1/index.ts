import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logError } from "../lib/errorlogger.js";
import { fail } from "./lib/response.js";
import { authRoutes } from "./routes/auth.js";
import { settingsRoutes } from "./routes/settings.js";
import { animeRoutes } from "./routes/anime.js";
import { episodesRoutes } from "./routes/episodes.js";
import { skipRoutes } from "./routes/skip.js";
import { adminRoutes } from "./routes/admin.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const JSONDEF_DIR = join(__dirname, "..", "jsondef");

export const app = new Hono();

app.route("/api/auth", authRoutes);
app.route("/api/settings", settingsRoutes);
app.route("/api/anime", animeRoutes);
app.route("/api/episodes", episodesRoutes);
app.route("/api/skip", skipRoutes);
app.route("/api/admin", adminRoutes);

// Lists all Swagger JSON definitions available in src/jsondef/.
app.post("/docs/index", async (context) => {
  try {
    const entries = await readdir(JSONDEF_DIR).catch(() => [] as string[]);
    const files = entries.filter((name) => name.endsWith(".json"));
    return context.json({ success: true, http_code: 200, message: "OK", data: { files } }, 200);
  } catch (err) {
    await logError("docs.index", err);
    return context.json(fail("Internal server error", 500), 500);
  }
});

// Serves a single Swagger JSON definition by filename.
app.post("/docs/file", async (context) => {
  try {
    const body = await context.req.json().catch(() => ({}) as Record<string, unknown>);
    const name = typeof body.name === "string" ? body.name : "";
    if (!name || !name.endsWith(".json") || name.includes("..") || name.includes("/")) {
      return context.json(fail("Invalid file name", 422), 422);
    }
    const contents = await readFile(join(JSONDEF_DIR, name), "utf8");
    return context.json({ success: true, http_code: 200, message: "OK", data: JSON.parse(contents) }, 200);
  } catch (err) {
    await logError("docs.file", err);
    return context.json(fail("Swagger definition not found", 404), 404);
  }
});

app.notFound((context) => context.json(fail("Not found", 404), 404));

app.onError(async (err, context) => {
  await logError("app.onError", err);
  return context.json(fail("Internal server error", 500), 500);
});

const port = Number(process.env.PORT ?? 3000);

if (process.env.NODE_ENV !== "test") {
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Animedy backend listening on port ${info.port}`);
  });
}
