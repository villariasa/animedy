import { describe, expect, test, beforeAll, beforeEach, jest } from "@jest/globals";
import request from "supertest";
import { createTestApp, routeQueries, type TestApp } from "./helpers/testApp.js";
import { makeAnimeRow } from "./helpers/fixtures.js";
import {
  SEARCH_ANIME_BY_TITLE,
  SELECT_ANIME_BY_ANILIST_ID,
  SELECT_ANIME_BY_ID,
  SELECT_FRANCHISE_ENTRIES,
  INSERT_ANIME
} from "../queries/anime.js";

let ctx: TestApp;
const realFetch = global.fetch;

/** AniList GraphQL search fixture (Bleach — PRD reference franchise). */
const BLEACH_MEDIA = {
  id: 269,
  idMal: 269,
  title: { romaji: "Bleach", english: "Bleach", native: "BLEACH" },
  synonyms: [],
  format: "TV",
  status: "FINISHED",
  season: "FALL",
  seasonYear: 2004,
  startDate: { year: 2004, month: 10, day: 5 },
  endDate: { year: 2012, month: 3, day: 27 },
  episodes: 366,
  duration: 24,
  description: "Soul Reaper stuff.",
  coverImage: { extraLarge: "x.jpg", large: "l.jpg", medium: "m.jpg" },
  bannerImage: null
};

beforeAll(async () => {
  ctx = await createTestApp();
});

beforeEach(() => {
  ctx.queryMock.mockReset();
  global.fetch = realFetch;
});

describe("POST /api/anime/search", () => {
  test("cache hit: returns cached rows without external call", async () => {
    const row = makeAnimeRow();
    routeQueries(ctx.queryMock, [
      { sql: SEARCH_ANIME_BY_TITLE, result: [{ ...row, id: row.id }] }
    ]);
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    const res = await request(ctx.server).post("/api/anime/search").send({ query: "bleach" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.results[0]).toMatchObject({ anime_id: 10, title_english: "Bleach" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("cache miss: fetches AniList (mocked fixture), upserts, returns results", async () => {
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ data: { Page: { media: [BLEACH_MEDIA] } } }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    ) as unknown as typeof fetch;
    routeQueries(ctx.queryMock, [
      { sql: SEARCH_ANIME_BY_TITLE, result: [] },
      { sql: INSERT_ANIME, result: {} },
      { sql: SELECT_ANIME_BY_ANILIST_ID, result: [makeAnimeRow()] }
    ]);
    const res = await request(ctx.server).post("/api/anime/search").send({ query: "bleach" });
    expect(res.status).toBe(200);
    expect(res.body.data.results).toHaveLength(1);
    expect(res.body.data.results[0].anilist_id).toBe(269);
  });

  test("external failure with empty cache → 502 envelope", async () => {
    global.fetch = jest.fn(async () => new Response("down", { status: 500 })) as unknown as typeof fetch;
    routeQueries(ctx.queryMock, [{ sql: SEARCH_ANIME_BY_TITLE, result: [] }]);
    const res = await request(ctx.server).post("/api/anime/search").send({ query: "bleach" });
    expect(res.status).toBe(502);
    expect(res.body).toMatchObject({ success: false, http_code: 502, data: null });
  });

  test("validation failure: missing query → 422", async () => {
    const res = await request(ctx.server).post("/api/anime/search").send({});
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });
});

describe("POST /api/anime/details", () => {
  test("success: fresh cached row is returned without external fetch", async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    routeQueries(ctx.queryMock, [{ sql: SELECT_ANIME_BY_ID, result: [makeAnimeRow()] }]);
    const res = await request(ctx.server).post("/api/anime/details").send({ anime_id: 10 });
    expect(res.status).toBe(200);
    expect(res.body.data.anime).toMatchObject({ id: 10, title_romaji: "Bleach", episode_count: 366 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("validation failure: empty body → 422", async () => {
    const res = await request(ctx.server).post("/api/anime/details").send({});
    expect(res.status).toBe(422);
  });
});

describe("POST /api/anime/franchise", () => {
  test("success: existing franchise_key returns ordered entries", async () => {
    const entries = [
      { anime_id: 10, title_english: "Bleach", sequence_order: 1, season_label: "Season 1" },
      { anime_id: 11, title_english: "Bleach: Thousand-Year Blood War", sequence_order: 2, season_label: "Season 2" }
    ];
    routeQueries(ctx.queryMock, [
      { sql: SELECT_ANIME_BY_ID, result: [makeAnimeRow()] },
      { sql: SELECT_FRANCHISE_ENTRIES, result: entries }
    ]);
    const res = await request(ctx.server).post("/api/anime/franchise").send({ anime_id: 10 });
    expect(res.status).toBe(200);
    expect(res.body.data.franchise_key).toBe("269");
    expect(res.body.data.entries.map((e: { sequence_order: number }) => e.sequence_order)).toEqual([1, 2]);
  });
});

describe("POST /api/anime/refresh", () => {
  test("auth failure: requires token → 401", async () => {
    const res = await request(ctx.server).post("/api/anime/refresh").send({ anime_id: 10 });
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, http_code: 401 });
  });
});
