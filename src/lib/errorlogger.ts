import { appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LOG_DIR = join(__dirname, "..", "..", "logs");
const LOG_FILE = join(LOG_DIR, "error.log");

function serializeError(err: unknown): string {
  if (err instanceof Error) {
    return `${err.name}: ${err.message}\n${err.stack ?? ""}`;
  }
  return JSON.stringify(err);
}

/**
 * Logs an error to console and appends a structured line to logs/error.log.
 * Never throws — logging failures must not break request handling.
 */
export async function logError(context: string, err: unknown): Promise<void> {
  const timestamp = new Date().toISOString();
  const message = serializeError(err);
  const line = `[${timestamp}] [${context}] ${message}\n`;

  console.error(line);

  try {
    await mkdir(LOG_DIR, { recursive: true });
    await appendFile(LOG_FILE, line, { encoding: "utf8" });
  } catch {
    // Swallow secondary failures writing to the log file.
  }
}
