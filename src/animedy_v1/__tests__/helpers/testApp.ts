// Shared backend test harness: mocks the DB layer (src/lib/dbconn.ts is
// protected — mocked, never modified) and the error logger, then imports the
// real Hono app. External HTTP (AniList/Jikan/AniSkip) is mocked via
// global.fetch in individual test files — no live network or DB.
import { jest } from "@jest/globals";
import type { Server } from "node:net";

type QueryFn = (sql: string, params?: ReadonlyArray<unknown>) => Promise<unknown>;

export interface TestApp {
  server: Server;
  queryMock: jest.MockedFunction<QueryFn>;
  signToken: (claims: { user_id: number; username: string; role: "user" | "admin" }) => string;
}

export const USER_TOKEN_CLAIMS = { user_id: 1, username: "tester", role: "user" as const };

export async function createTestApp(): Promise<TestApp> {
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test_secret_for_jest";
  const queryMock = jest.fn<QueryFn>();

  const dbconnPath = new URL("../../../lib/dbconn.ts", import.meta.url).pathname;
  const errorloggerPath = new URL("../../../lib/errorlogger.ts", import.meta.url).pathname;
  jest.unstable_mockModule(dbconnPath, () => ({
    getPool: jest.fn(),
    query: (sql: string, params?: ReadonlyArray<unknown>) => queryMock(sql, params),
    closePool: jest.fn(async () => undefined)
  }));
  jest.unstable_mockModule(errorloggerPath, () => ({
    logError: jest.fn(async () => undefined)
  }));

  const { app } = await import("../../index.js");
  const { signToken } = await import("../../utils/auth.js");
  const { createAdaptorServer } = await import("@hono/node-server");
  const server = createAdaptorServer({ fetch: app.fetch }) as unknown as Server;
  return { server, queryMock, signToken };
}

/** Route queryMock calls by exact SQL constant; unmatched SQL throws loudly. */
export function routeQueries(
  queryMock: jest.MockedFunction<QueryFn>,
  routes: Array<{ sql: string; result: unknown | ((params: ReadonlyArray<unknown>) => unknown) }>
): void {
  queryMock.mockImplementation(async (sql, params = []) => {
    const route = routes.find((r) => r.sql === sql);
    if (!route) {
      throw new Error(`Unmocked SQL in test: ${sql.slice(0, 80)}...`);
    }
    return typeof route.result === "function"
      ? (route.result as (p: ReadonlyArray<unknown>) => unknown)(params)
      : route.result;
  });
}
