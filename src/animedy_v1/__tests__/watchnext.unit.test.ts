// T6.2 — continuation-engine priority order unit tests (utils/watchnext.ts).
import { describe, expect, test, beforeAll, beforeEach } from "@jest/globals";
import { createTestApp, type TestApp } from "./helpers/testApp.js";
import { makeAnimeRow } from "./helpers/fixtures.js";
import { SELECT_NEXT_FRANCHISE_ENTRY, SELECT_RELATED_RECOMMENDATIONS, SELECT_ANIME_BY_ID } from "../queries/anime.js";
import {
  SELECT_EPISODE_BY_ID,
  SELECT_FIRST_EPISODE_OF_ANIME,
  SELECT_NEXT_EPISODE
} from "../queries/episodes.js";
import {
  SELECT_USER_HAS_WATCHED_ANIME,
  SELECT_WATCH_PROGRESS,
  SELECT_WATCH_STATE_BY_USER_AND_FRANCHISE
} from "../queries/progress.js";

let ctx: TestApp;
let computeWatchNext: (
  userId: number,
  franchiseKey: string
) => Promise<{ type: string; reason: string; anime: { anime_id: number } | null }>;

const STATE = {
  user_id: 1,
  franchise_key: "1",
  current_anime_id: 10,
  current_episode_id: 100,
  series_completed: 0,
  franchise_completed: 0
};
const EPISODE = { id: 100, anime_id: 10, episode_number: 25, title: "Finale" };
const AOT_S1 = makeAnimeRow({ id: 10, anilist_id: 1, title_romaji: "Attack on Titan", title_english: "Attack on Titan", format: "TV" });

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

function baseRoutes(overrides: SqlRouter = {}): SqlRouter {
  return {
    [SELECT_WATCH_STATE_BY_USER_AND_FRANCHISE]: [STATE],
    [SELECT_EPISODE_BY_ID]: [EPISODE],
    [SELECT_ANIME_BY_ID]: [AOT_S1],
    [SELECT_WATCH_PROGRESS]: [],
    [SELECT_NEXT_EPISODE]: [],
    [SELECT_NEXT_FRANCHISE_ENTRY]: [],
    [SELECT_FIRST_EPISODE_OF_ANIME]: [{ id: 200, anime_id: 11, episode_number: 1, title: null }],
    [SELECT_RELATED_RECOMMENDATIONS]: [],
    [SELECT_USER_HAS_WATCHED_ANIME]: [{ total: 0 }],
    ...overrides
  };
}

beforeAll(async () => {
  ctx = await createTestApp();
  ({ computeWatchNext } = await import("../utils/watchnext.js"));
});

beforeEach(() => {
  ctx.queryMock.mockReset();
});

describe("continuation engine priority order", () => {
  test("1. RESUME: unfinished current episode wins over everything", async () => {
    route(
      baseRoutes({
        [SELECT_WATCH_PROGRESS]: [{ completed: 0, position_seconds: 500 }],
        [SELECT_NEXT_EPISODE]: [{ id: 101, anime_id: 10, episode_number: 26, title: null }]
      })
    );
    const result = await computeWatchNext(1, "1");
    expect(result.type).toBe("RESUME");
  });

  test("2. NEXT_EPISODE: completed current → next episode in same series", async () => {
    route(
      baseRoutes({
        [SELECT_WATCH_PROGRESS]: [{ completed: 1, position_seconds: 1400 }],
        [SELECT_NEXT_EPISODE]: [{ id: 101, anime_id: 10, episode_number: 26, title: null }]
      })
    );
    const result = await computeWatchNext(1, "1");
    expect(result.type).toBe("NEXT_EPISODE");
  });

  test("3. NEXT_SEASON: next franchise entry shares the title root", async () => {
    route(
      baseRoutes({
        [SELECT_NEXT_FRANCHISE_ENTRY]: [
          makeAnimeRow({ id: 11, anilist_id: 2, title_romaji: "Attack on Titan Season 2", title_english: "Attack on Titan Season 2", format: "TV" })
        ]
      })
    );
    const result = await computeWatchNext(1, "1");
    expect(result.type).toBe("NEXT_SEASON");
  });

  test("4. SEQUEL: next TV entry with a different title root (Naruto → Boruto)", async () => {
    route(
      baseRoutes({
        [SELECT_ANIME_BY_ID]: [makeAnimeRow({ id: 10, title_romaji: "Naruto Shippuden", title_english: "Naruto Shippuden" })],
        [SELECT_NEXT_FRANCHISE_ENTRY]: [
          makeAnimeRow({ id: 11, anilist_id: 3, title_romaji: "Boruto: Naruto Next Generations", title_english: "Boruto", format: "TV" })
        ]
      })
    );
    const result = await computeWatchNext(1, "1");
    expect(result.type).toBe("SEQUEL");
  });

  test("5. MOVIE: next franchise entry with MOVIE format", async () => {
    route(
      baseRoutes({
        [SELECT_NEXT_FRANCHISE_ENTRY]: [makeAnimeRow({ id: 12, anilist_id: 4, format: "MOVIE" })]
      })
    );
    const result = await computeWatchNext(1, "1");
    expect(result.type).toBe("MOVIE");
  });

  test("6. SPECIAL_OR_OVA: next franchise entry with OVA format", async () => {
    route(
      baseRoutes({
        [SELECT_NEXT_FRANCHISE_ENTRY]: [makeAnimeRow({ id: 13, anilist_id: 5, format: "OVA" })]
      })
    );
    const result = await computeWatchNext(1, "1");
    expect(result.type).toBe("SPECIAL_OR_OVA");
  });

  test("7. RECOMMENDATION: franchise completed → first unwatched related entry", async () => {
    route(
      baseRoutes({
        [SELECT_WATCH_STATE_BY_USER_AND_FRANCHISE]: [{ ...STATE, franchise_completed: 1 }],
        [SELECT_RELATED_RECOMMENDATIONS]: [
          { ...makeAnimeRow({ id: 14, anilist_id: 6, title_english: "Attack on Titan: Junior High" }), relation_type: "SPIN_OFF" }
        ]
      })
    );
    const result = await computeWatchNext(1, "1");
    expect(result.type).toBe("RECOMMENDATION");
  });

  test("recommendation skips already-watched candidates", async () => {
    const candidates = [
      { ...makeAnimeRow({ id: 14, anilist_id: 6 }), relation_type: "SPIN_OFF" },
      { ...makeAnimeRow({ id: 15, anilist_id: 7 }), relation_type: "SIDE_STORY" }
    ];
    route(
      baseRoutes({
        [SELECT_WATCH_STATE_BY_USER_AND_FRANCHISE]: [{ ...STATE, franchise_completed: 1 }],
        [SELECT_RELATED_RECOMMENDATIONS]: candidates,
        [SELECT_USER_HAS_WATCHED_ANIME]: (params: ReadonlyArray<unknown>) =>
          params[1] === 14 ? [{ total: 3 }] : [{ total: 0 }]
      })
    );
    const result = (await computeWatchNext(1, "1")) as { type: string; anime: { anime_id: number } };
    expect(result.type).toBe("RECOMMENDATION");
    expect(result.anime.anime_id).toBe(15);
  });

  test("8. NONE: nothing left anywhere", async () => {
    route(baseRoutes({ [SELECT_WATCH_STATE_BY_USER_AND_FRANCHISE]: [{ ...STATE, franchise_completed: 1 }] }));
    const result = await computeWatchNext(1, "1");
    expect(result.type).toBe("NONE");
  });
});
