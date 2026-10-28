import { describe, expect, test, beforeAll, beforeEach } from "@jest/globals";
import request from "supertest";
import { createTestApp, routeQueries, USER_TOKEN_CLAIMS, type TestApp } from "./helpers/testApp.js";
import { makeSettingsRow } from "./helpers/fixtures.js";
import { INSERT_DEFAULT_SETTINGS, SELECT_SETTINGS_BY_USER, UPSERT_SETTINGS } from "../queries/settings.js";

let ctx: TestApp;
let token: string;

beforeAll(async () => {
  ctx = await createTestApp();
  token = ctx.signToken(USER_TOKEN_CLAIMS);
});

beforeEach(() => {
  ctx.queryMock.mockReset();
});

describe("POST /api/settings/get", () => {
  test("success: returns settings payload for {} body", async () => {
    routeQueries(ctx.queryMock, [{ sql: SELECT_SETTINGS_BY_USER, result: [makeSettingsRow()] }]);
    const res = await request(ctx.server)
      .post("/api/settings/get")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.settings).toMatchObject({
      volume: 1,
      autoplay: true,
      metadata_source: "anilist",
      skip_source: "aniskip"
    });
  });

  test("auto-creates default settings row when missing", async () => {
    let created = false;
    ctx.queryMock.mockImplementation(async (sql) => {
      if (sql === SELECT_SETTINGS_BY_USER) {
        return created ? [makeSettingsRow()] : [];
      }
      if (sql === INSERT_DEFAULT_SETTINGS) {
        created = true;
        return {};
      }
      throw new Error(`Unmocked SQL: ${sql.slice(0, 60)}`);
    });
    const res = await request(ctx.server)
      .post("/api/settings/get")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
    expect(created).toBe(true);
    expect(res.body.data.settings.countdown_seconds).toBe(10);
  });

  test("auth failure: no token → 401", async () => {
    const res = await request(ctx.server).post("/api/settings/get").send({});
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, http_code: 401, data: null });
  });
});

describe("POST /api/settings/save", () => {
  test("success: partial patch merges and upserts", async () => {
    const upserts: ReadonlyArray<unknown>[] = [];
    ctx.queryMock.mockImplementation(async (sql, params = []) => {
      if (sql === SELECT_SETTINGS_BY_USER) {
        return [makeSettingsRow({ auto_skip_intro: 1, countdown_seconds: 5 })];
      }
      if (sql === UPSERT_SETTINGS) {
        upserts.push(params);
        return {};
      }
      throw new Error(`Unmocked SQL: ${sql.slice(0, 60)}`);
    });
    const res = await request(ctx.server)
      .post("/api/settings/save")
      .set("Authorization", `Bearer ${token}`)
      .send({ auto_skip_intro: true, countdown_seconds: 5 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(upserts.length).toBe(1);
    expect(res.body.data.settings.auto_skip_intro).toBe(true);
    expect(res.body.data.settings.countdown_seconds).toBe(5);
  });

  test("validation failure: wrong type → 422", async () => {
    const res = await request(ctx.server)
      .post("/api/settings/save")
      .set("Authorization", `Bearer ${token}`)
      .send({ volume: "loud" });
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  test("auth failure: no token → 401", async () => {
    const res = await request(ctx.server).post("/api/settings/save").send({ volume: 0.5 });
    expect(res.status).toBe(401);
  });
});
