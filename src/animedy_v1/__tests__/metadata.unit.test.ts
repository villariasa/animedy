// T6.2 — metadata fallback chain unit tests (utils/metadata.ts):
// selected source → other source → stale cache → MetadataFetchError.
import { describe, expect, test, beforeAll, beforeEach, jest } from "@jest/globals";
import { createTestApp, type TestApp } from "./helpers/testApp.js";
import { makeAnimeRow } from "./helpers/fixtures.js";
import {
  SELECT_ANIME_BY_ID,
  SELECT_ANIME_BY_MAL_ID,
  INSERT_ANIME,
  UPDATE_ANIME_BY_ID
} from "../queries/anime.js";
import type { AnimeRow, MetadataSource } from "../interfaces/db.js";

let ctx: TestApp;
let resolveAnimeRow: (
  params: { anime_id?: number; anilist_id?: number },
  source: MetadataSource,
  force?: boolean
) => Promise<AnimeRow>;
let MetadataFetchError: new (m: string) => Error;
const realFetch = global.fetch;

const STALE_DATE = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

const JIKAN_FIXTURE = {
  data: {
    mal_id: 269,
    titles: [
      { type: "Default", title: "Bleach" },
      { type: "English", title: "Bleach" },
      { type: "Japanese", title: "BLEACH" }
    ],
    type: "TV",
    status: "Finished Airing",
    season: "fall",
    year: 2004,
    aired: { from: "2004-10-05T00:00:00+00:00", to: "2012-03-27T00:00:00+00:00" },
    episodes: 366,
    synopsis: "Soul Reaper stuff.",
    images: { jpg: { image_url: "i.jpg", large_image_url: "l.jpg" } }
  }
};

beforeAll(async () => {
  ctx = await createTestApp();
  const metadata = await import("../utils/metadata.js");
  resolveAnimeRow = metadata.resolveAnimeRow;
  MetadataFetchError = metadata.MetadataFetchError;
});

beforeEach(() => {
  ctx.queryMock.mockReset();
  global.fetch = realFetch;
});

describe("resolveAnimeRow fallback chain", () => {
  test("fresh cache is returned without any external fetch", async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    ctx.queryMock.mockImplementation(async (sql) => {
      if (sql === SELECT_ANIME_BY_ID) {
        return [makeAnimeRow()];
      }
      throw new Error("unexpected SQL");
    });
    const row = await resolveAnimeRow({ anime_id: 10 }, "anilist");
    expect(row.id).toBe(10);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("stale cache + preferred source down → other source (Jikan) used and upserted", async () => {
    global.fetch = jest.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("graphql.anilist.co")) {
        return new Response("down", { status: 503 });
      }
      return new Response(JSON.stringify(JIKAN_FIXTURE), { status: 200 });
    }) as unknown as typeof fetch;

    const updates: ReadonlyArray<unknown>[] = [];
    const staleRow = makeAnimeRow({ cached_at: STALE_DATE });
    ctx.queryMock.mockImplementation(async (sql, params = []) => {
      if (sql === SELECT_ANIME_BY_ID || sql === SELECT_ANIME_BY_MAL_ID) {
        return [staleRow];
      }
      if (sql === UPDATE_ANIME_BY_ID || sql === INSERT_ANIME) {
        updates.push(params);
        return {};
      }
      throw new Error(`unexpected SQL: ${sql.slice(0, 50)}`);
    });

    const row = await resolveAnimeRow({ anime_id: 10 }, "anilist");
    expect(row.mal_id).toBe(269);
    expect(updates.length).toBeGreaterThan(0);
  });

  test("both sources down → stale cache served", async () => {
    global.fetch = jest.fn(async () => new Response("down", { status: 503 })) as unknown as typeof fetch;
    const staleRow = makeAnimeRow({ cached_at: STALE_DATE, title_english: "Stale Bleach" });
    ctx.queryMock.mockImplementation(async (sql) => {
      if (sql === SELECT_ANIME_BY_ID) {
        return [staleRow];
      }
      throw new Error("unexpected SQL");
    });
    const row = await resolveAnimeRow({ anime_id: 10 }, "anilist");
    expect(row.title_english).toBe("Stale Bleach");
  });

  test("both sources down + no cache → MetadataFetchError", async () => {
    global.fetch = jest.fn(async () => new Response("down", { status: 503 })) as unknown as typeof fetch;
    ctx.queryMock.mockResolvedValue([]);
    await expect(resolveAnimeRow({ anilist_id: 269 }, "anilist")).rejects.toBeInstanceOf(MetadataFetchError);
  });

  test("forceRefresh bypasses a fresh cache and refetches", async () => {
    const calls: string[] = [];
    global.fetch = jest.fn(async (input: string | URL | Request) => {
      calls.push(String(input));
      return new Response(JSON.stringify(JIKAN_FIXTURE), { status: 200 });
    }) as unknown as typeof fetch;
    const freshRow = makeAnimeRow();
    ctx.queryMock.mockImplementation(async (sql) => {
      if (sql === SELECT_ANIME_BY_ID || sql === SELECT_ANIME_BY_MAL_ID) {
        return [freshRow];
      }
      if (sql === UPDATE_ANIME_BY_ID || sql === INSERT_ANIME) {
        return {};
      }
      throw new Error(`unexpected SQL: ${sql.slice(0, 50)}`);
    });
    await resolveAnimeRow({ anime_id: 10 }, "mal", true);
    expect(calls.some((u) => u.includes("api.jikan.moe"))).toBe(true);
  });
});
