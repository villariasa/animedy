// T6.2 — franchise walker unit tests (utils/franchise.ts): Attack on Titan
// reference graph — root found via PREQUEL walk, SEQUEL chain ordered by
// start_date, side entries (movie) appended after the main chain.
import { expect, test, beforeAll, beforeEach, jest } from "@jest/globals";
import { createTestApp, type TestApp } from "./helpers/testApp.js";
import { makeAnimeRow } from "./helpers/fixtures.js";
import {
  INSERT_ANIME,
  INSERT_ANIME_RELATION,
  SELECT_ANIME_BY_ANILIST_ID
} from "../queries/anime.js";
import type { AniListMedia } from "../interfaces/external.js";

let ctx: TestApp;
let walkAndPersistFranchise: (media: AniListMedia) => Promise<string>;
const realFetch = global.fetch;

// Node metadata per id — mirrors full MEDIA_FIELDS (the real relations
// fragment requests complete media fields for each node).
const NODE_META: Record<number, { title: string; year: number; format: string }> = {
  1: { title: "Attack on Titan", year: 2013, format: "TV" },
  2: { title: "Attack on Titan Season 2", year: 2017, format: "TV" },
  3: { title: "Attack on Titan Season 3", year: 2018, format: "TV" },
  4: { title: "Attack on Titan: Chronicle", year: 2020, format: "MOVIE" }
};

function bareMedia(id: number): AniListMedia {
  const meta = NODE_META[id] ?? { title: `node ${id}`, year: 2000, format: "TV" };
  return {
    id,
    idMal: id,
    title: { romaji: meta.title, english: meta.title, native: meta.title },
    synonyms: [],
    format: meta.format,
    status: "FINISHED",
    season: "SPRING",
    seasonYear: meta.year,
    startDate: { year: meta.year, month: 4, day: 1 },
    endDate: { year: meta.year, month: 9, day: 30 },
    episodes: 12,
    duration: 24,
    description: null,
    coverImage: { extraLarge: "x", large: "l", medium: "m" },
    bannerImage: null
  } as unknown as AniListMedia;
}

function media(
  id: number,
  _title: string,
  _year: number,
  _format: string,
  edges: Array<{ relationType: string; nodeId: number }>
): AniListMedia {
  return {
    ...bareMedia(id),
    relations: {
      edges: edges.map((e) => ({ relationType: e.relationType, node: bareMedia(e.nodeId) }))
    }
  } as unknown as AniListMedia;
}

// AoT graph: S1(1) → S2(2) → S3(3); S2 has a SIDE_STORY movie (4).
const AOT_S1 = media(1, "Attack on Titan", 2013, "TV", [{ relationType: "SEQUEL", nodeId: 2 }]);
const AOT_S2 = media(2, "Attack on Titan Season 2", 2017, "TV", [
  { relationType: "PREQUEL", nodeId: 1 },
  { relationType: "SEQUEL", nodeId: 3 },
  { relationType: "SIDE_STORY", nodeId: 4 }
]);
const AOT_S3 = media(3, "Attack on Titan Season 3", 2018, "TV", [{ relationType: "PREQUEL", nodeId: 2 }]);
const AOT_MOVIE = media(4, "Attack on Titan: Chronicle", 2020, "MOVIE", []);
const BY_ID: Record<number, AniListMedia> = { 1: AOT_S1, 2: AOT_S2, 3: AOT_S3, 4: AOT_MOVIE };

beforeAll(async () => {
  ctx = await createTestApp();
  ({ walkAndPersistFranchise } = await import("../utils/franchise.js"));
});

beforeEach(() => {
  ctx.queryMock.mockReset();
  global.fetch = realFetch;
});

test("walks PREQUELs to the root, orders the chain, keys the franchise by root id", async () => {
  // Mock AniList GraphQL: answer fetchAniListMediaById by the id variable.
  global.fetch = jest.fn(async (_input: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { variables?: { id?: number } };
    const found = body.variables?.id !== undefined ? BY_ID[body.variables.id] : undefined;
    return new Response(JSON.stringify({ data: { Media: found ?? null } }), { status: 200 });
  }) as unknown as typeof fetch;

  const inserts: ReadonlyArray<unknown>[] = [];
  const relations: ReadonlyArray<unknown>[] = [];
  ctx.queryMock.mockImplementation(async (sql, params = []) => {
    if (sql === INSERT_ANIME) {
      inserts.push(params);
      return {};
    }
    if (sql === SELECT_ANIME_BY_ANILIST_ID) {
      const anilistId = Number(params[0]);
      return [makeAnimeRow({ id: 100 + anilistId, anilist_id: anilistId })];
    }
    if (sql === INSERT_ANIME_RELATION) {
      relations.push(params);
      return {};
    }
    throw new Error(`unexpected SQL: ${sql.slice(0, 50)}`);
  });

  // Start from S3 — the walker must find root S1 via PREQUEL edges.
  const franchiseKey = await walkAndPersistFranchise(AOT_S3);
  expect(franchiseKey).toBe("1");

  // INSERT_ANIME params: [0]=anilist_id, [17]=franchise_key, [18]=sequence_order, [19]=season_label.
  const ordered = inserts.map((p) => ({
    anilist_id: p[0],
    franchise_key: p[17],
    sequence_order: p[18],
    season_label: p[19]
  }));
  const mainChain = ordered.filter((r) => [1, 2, 3].includes(Number(r.anilist_id)));
  expect(mainChain.map((r) => [r.anilist_id, r.sequence_order])).toEqual([
    [1, 1],
    [2, 2],
    [3, 3]
  ]);
  expect(ordered.every((r) => r.franchise_key === "1")).toBe(true);

  // Season labels derived from titles; side movie appended after the chain.
  expect(mainChain.map((r) => r.season_label)).toEqual(["Season 1", "Season 2", "Season 3"]);
  const movie = ordered.find((r) => Number(r.anilist_id) === 4);
  expect(movie?.sequence_order).toBe(4);

  // Relation edges persisted: SEQUEL/PREQUEL pairs for the chain + side edge.
  const types = relations.map((p) => p[2]);
  expect(types).toEqual(expect.arrayContaining(["SEQUEL", "PREQUEL", "SIDE_STORY"]));
});
