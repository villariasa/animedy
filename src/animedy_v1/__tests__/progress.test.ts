import { describe, expect, test, beforeAll, beforeEach } from "@jest/globals";
import request from "supertest";
import { createTestApp, USER_TOKEN_CLAIMS, type TestApp } from "./helpers/testApp.js";
import {
  SELECT_WATCH_PROGRESS,
  UPSERT_WATCH_PROGRESS,
  UPSERT_WATCH_STATE
} from "../queries/progress.js";
import {
  SELECT_EPISODE_ANIME_INFO,
  SELECT_FIRST_EPISODE_OF_ANIME,
  SELECT_NEXT_EPISODE
} from "../queries/episodes.js";
import { SELECT_NEXT_FRANCHISE_ENTRY } from "../queries/anime.js";

let ctx: TestApp;
let token: string;

const EP_INFO = { episode_id: 100, anime_id: 10, episode_number: 1, franchise_key: "269", sequence_order: 1 };
const PROGRESS_ROW = {
  user_id: 1,
  episode_id: 100,
  position_seconds: 300,
  duration_seconds: 1440,
  completed: 0,
  last_watched_at: "2026-10-28 12:00:00"
};

beforeAll(async () => {
  ctx = await createTestApp();
  token = ctx.signToken(USER_TOKEN_CLAIMS);
});

beforeEach(() => {
  ctx.queryMock.mockReset();
});

type SqlRouter = Record<string, unknown | ((params: ReadonlyArray<unknown>) => unknown)>;

function route(routes: SqlRouter): void {
  ctx.queryMock.mockImplementation(async (sql, params = []) => {
    if (!(sql in routes)) {
      throw new Error(`Unmocked SQL: ${sql.slice(0, 60)}`);
    }
    const r = routes[sql];
    return typeof r === "function" ? (r as (p: ReadonlyArray<unknown>) => unknown)(params) : r;
  });
}

describe("POST /api/progress/save", () => {
  test("success: saves heartbeat, not completed below 90%", async () => {
    route({
      [SELECT_EPISODE_ANIME_INFO]: [EP_INFO],
      [UPSERT_WATCH_PROGRESS]: {},
      [UPSERT_WATCH_STATE]: {}
    });
    const res = await request(ctx.server)
      .post("/api/progress/save")
      .set("Authorization", `Bearer ${token}`)
      .send({ episode_id: 100, position_seconds: 300, duration_seconds: 1440 });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ episode_id: 100, position_seconds: 300, completed: false });
  });

  test("completion threshold: ≥90% marks completed", async () => {
    route({
      [SELECT_EPISODE_ANIME_INFO]: [EP_INFO],
      [UPSERT_WATCH_PROGRESS]: {},
      [UPSERT_WATCH_STATE]: {}
    });
    const res = await request(ctx.server)
      .post("/api/progress/save")
      .set("Authorization", `Bearer ${token}`)
      .send({ episode_id: 100, position_seconds: 1400, duration_seconds: 1440 });
    expect(res.status).toBe(200);
    expect(res.body.data.completed).toBe(true);
  });

  test("unknown episode → 404", async () => {
    route({ [SELECT_EPISODE_ANIME_INFO]: [] });
    const res = await request(ctx.server)
      .post("/api/progress/save")
      .set("Authorization", `Bearer ${token}`)
      .send({ episode_id: 999, position_seconds: 10, duration_seconds: 100 });
    expect(res.status).toBe(404);
  });

  test("validation failure → 422; auth failure → 401", async () => {
    const bad = await request(ctx.server)
      .post("/api/progress/save")
      .set("Authorization", `Bearer ${token}`)
      .send({ episode_id: 100 });
    expect(bad.status).toBe(422);
    const noAuth = await request(ctx.server)
      .post("/api/progress/save")
      .send({ episode_id: 100, position_seconds: 1, duration_seconds: 2 });
    expect(noAuth.status).toBe(401);
  });
});

describe("POST /api/progress/get", () => {
  test("success: returns stored row", async () => {
    route({ [SELECT_WATCH_PROGRESS]: [PROGRESS_ROW] });
    const res = await request(ctx.server)
      .post("/api/progress/get")
      .set("Authorization", `Bearer ${token}`)
      .send({ episode_id: 100 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ episode_id: 100, position_seconds: 300, completed: false });
  });

  test("success: empty default when no row", async () => {
    route({ [SELECT_WATCH_PROGRESS]: [] });
    const res = await request(ctx.server)
      .post("/api/progress/get")
      .set("Authorization", `Bearer ${token}`)
      .send({ episode_id: 100 });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      episode_id: 100,
      position_seconds: 0,
      duration_seconds: 0,
      completed: false,
      last_watched_at: null
    });
  });
});

describe("POST /api/progress/complete (watch_state advance)", () => {
  test("advances to next episode in the same series", async () => {
    route({
      [SELECT_EPISODE_ANIME_INFO]: [EP_INFO],
      [SELECT_WATCH_PROGRESS]: [PROGRESS_ROW],
      [UPSERT_WATCH_PROGRESS]: {},
      [SELECT_NEXT_EPISODE]: [{ id: 101, anime_id: 10, episode_number: 2 }],
      [UPSERT_WATCH_STATE]: {}
    });
    const res = await request(ctx.server)
      .post("/api/progress/complete")
      .set("Authorization", `Bearer ${token}`)
      .send({ episode_id: 100 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ next_episode_id: 101, franchise_completed: false });
  });

  test("end of series → advances to next franchise entry's first episode", async () => {
    route({
      [SELECT_EPISODE_ANIME_INFO]: [EP_INFO],
      [SELECT_WATCH_PROGRESS]: [PROGRESS_ROW],
      [UPSERT_WATCH_PROGRESS]: {},
      [SELECT_NEXT_EPISODE]: [],
      [SELECT_NEXT_FRANCHISE_ENTRY]: [{ id: 11, sequence_order: 2 }],
      [SELECT_FIRST_EPISODE_OF_ANIME]: [{ id: 200, anime_id: 11, episode_number: 1 }],
      [UPSERT_WATCH_STATE]: {}
    });
    const res = await request(ctx.server)
      .post("/api/progress/complete")
      .set("Authorization", `Bearer ${token}`)
      .send({ episode_id: 100 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ next_episode_id: 200, franchise_completed: false });
  });

  test("end of franchise → franchise_completed true", async () => {
    route({
      [SELECT_EPISODE_ANIME_INFO]: [EP_INFO],
      [SELECT_WATCH_PROGRESS]: [PROGRESS_ROW],
      [UPSERT_WATCH_PROGRESS]: {},
      [SELECT_NEXT_EPISODE]: [],
      [SELECT_NEXT_FRANCHISE_ENTRY]: [],
      [UPSERT_WATCH_STATE]: {}
    });
    const res = await request(ctx.server)
      .post("/api/progress/complete")
      .set("Authorization", `Bearer ${token}`)
      .send({ episode_id: 100 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ next_episode_id: null, franchise_completed: true });
  });
});
