import { describe, expect, test, beforeAll, beforeEach, jest } from "@jest/globals";
import request from "supertest";
import { createTestApp, USER_TOKEN_CLAIMS, type TestApp } from "./helpers/testApp.js";
import {
  SELECT_SKIP_SEGMENTS_BY_EPISODE_AND_SOURCE,
  UPSERT_SKIP_SEGMENT
} from "../queries/skip.js";
import { SELECT_EPISODE_WITH_ANIME_MAL } from "../queries/episodes.js";

let ctx: TestApp;
let token: string;
const realFetch = global.fetch;

const EPISODE = { id: 100, anime_id: 10, episode_number: 1, mal_id: 269 };
const ANISKIP_ROW = {
  id: 1,
  episode_id: 100,
  skip_type: "intro",
  start_seconds: 10,
  end_seconds: 95,
  source: "aniskip"
};
const MANUAL_ROW = { ...ANISKIP_ROW, id: 2, skip_type: "outro", source: "manual" };

beforeAll(async () => {
  ctx = await createTestApp();
  token = ctx.signToken(USER_TOKEN_CLAIMS);
});

beforeEach(() => {
  ctx.queryMock.mockReset();
  global.fetch = realFetch;
});

describe("POST /api/skip/get", () => {
  test("success: cached aniskip segments returned first (default source order)", async () => {
    ctx.queryMock.mockImplementation(async (sql, params = []) => {
      if (sql === SELECT_EPISODE_WITH_ANIME_MAL) {
        return [EPISODE];
      }
      if (sql === SELECT_SKIP_SEGMENTS_BY_EPISODE_AND_SOURCE) {
        return params[1] === "aniskip" ? [ANISKIP_ROW] : [];
      }
      throw new Error(`Unmocked SQL: ${sql.slice(0, 60)}`);
    });
    const res = await request(ctx.server).post("/api/skip/get").send({ episode_id: 100 });
    expect(res.status).toBe(200);
    expect(res.body.data.segments).toEqual([
      { skip_type: "intro", start_seconds: 10, end_seconds: 95, source: "aniskip" }
    ]);
  });

  test("fallback: no aniskip (lazy AniSkip fetch misses too) → manual segments", async () => {
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ found: false, results: [] }), { status: 200 })
    ) as unknown as typeof fetch;
    ctx.queryMock.mockImplementation(async (sql, params = []) => {
      if (sql === SELECT_EPISODE_WITH_ANIME_MAL) {
        return [EPISODE];
      }
      if (sql === SELECT_SKIP_SEGMENTS_BY_EPISODE_AND_SOURCE) {
        return params[1] === "manual" ? [MANUAL_ROW] : [];
      }
      throw new Error(`Unmocked SQL: ${sql.slice(0, 60)}`);
    });
    const res = await request(ctx.server).post("/api/skip/get").send({ episode_id: 100 });
    expect(res.status).toBe(200);
    expect(res.body.data.segments[0].source).toBe("manual");
  });

  test("unknown episode → 404", async () => {
    ctx.queryMock.mockResolvedValue([]);
    const res = await request(ctx.server).post("/api/skip/get").send({ episode_id: 999 });
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test("validation failure: missing episode_id → 422", async () => {
    const res = await request(ctx.server).post("/api/skip/get").send({});
    expect(res.status).toBe(422);
  });
});

describe("POST /api/skip/set", () => {
  test("success: manual segment upserted and echoed", async () => {
    const upserts: ReadonlyArray<unknown>[] = [];
    ctx.queryMock.mockImplementation(async (sql, params = []) => {
      if (sql === UPSERT_SKIP_SEGMENT) {
        upserts.push(params);
        return {};
      }
      throw new Error(`Unmocked SQL: ${sql.slice(0, 60)}`);
    });
    const res = await request(ctx.server)
      .post("/api/skip/set")
      .set("Authorization", `Bearer ${token}`)
      .send({ episode_id: 100, skip_type: "intro", start_seconds: 12, end_seconds: 90 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ episode_id: 100, skip_type: "intro", source: "manual" });
    expect(upserts[0]).toEqual([100, "intro", 12, 90, "manual"]);
  });

  test("auth failure: no token → 401", async () => {
    const res = await request(ctx.server)
      .post("/api/skip/set")
      .send({ episode_id: 100, skip_type: "intro", start_seconds: 12, end_seconds: 90 });
    expect(res.status).toBe(401);
  });

  test("validation failure: end before start types wrong → 422", async () => {
    const res = await request(ctx.server)
      .post("/api/skip/set")
      .set("Authorization", `Bearer ${token}`)
      .send({ episode_id: 100, skip_type: "intro", start_seconds: "a", end_seconds: 90 });
    expect(res.status).toBe(422);
  });
});
