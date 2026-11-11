// Minimal Cloudflare D1 / Pages Functions types — kept local so the
// functions bundle has zero npm dependencies (wrangler compiles TS as-is).

export interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: { last_row_id: number; changes: number };
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

export interface R2ObjectBody {
  body: ReadableStream;
  httpMetadata?: { contentType?: string };
}

export interface R2Bucket {
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob,
    options?: { httpMetadata?: { contentType?: string } }
  ): Promise<unknown>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(key: string): Promise<void>;
}

export interface Env {
  DB: D1Database;
  AVATARS?: R2Bucket;
  CHAT_MEDIA?: R2Bucket;
  JWT_SECRET: string;
  /** Optional — when set, register/login require a valid Turnstile token. */
  TURNSTILE_SECRET?: string;
  /** Optional — when set, enables GIF search in chat via GIPHY. */
  GIPHY_API_KEY?: string;
  /** Optional — fallback/legacy GIF search via Tenor. */
  TENOR_API_KEY?: string;
}

export interface PagesContext<P = Record<string, string>> {
  request: Request;
  env: Env;
  params: P;
  waitUntil(promise: Promise<unknown>): void;
}

export type PagesFunction<P = Record<string, string>> = (
  context: PagesContext<P>
) => Response | Promise<Response>;

export interface UserRow {
  id: number;
  email: string;
  username: string;
  password_hash: string;
  role: "user" | "admin";
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
}
