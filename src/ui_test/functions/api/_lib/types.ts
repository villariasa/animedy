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

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  /** Optional — when set, register/login require a valid Turnstile token. */
  TURNSTILE_SECRET?: string;
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
  created_at: string;
  updated_at: string;
}
