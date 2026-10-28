import { describe, expect, test, beforeAll, beforeEach } from "@jest/globals";
import request from "supertest";
import { createTestApp, routeQueries, USER_TOKEN_CLAIMS, type TestApp } from "./helpers/testApp.js";
import { makeUserRow, makeSettingsRow } from "./helpers/fixtures.js";
import {
  INSERT_USER,
  SELECT_USER_BY_EMAIL,
  SELECT_USER_BY_ID,
  SELECT_USER_BY_USERNAME
} from "../queries/users.js";
import { INSERT_DEFAULT_SETTINGS, SELECT_SETTINGS_BY_USER } from "../queries/settings.js";

let ctx: TestApp;

beforeAll(async () => {
  ctx = await createTestApp();
});

beforeEach(() => {
  ctx.queryMock.mockReset();
});

describe("POST /api/auth/register", () => {
  test("success: creates user, default settings, returns token + profile (201)", async () => {
    const user = makeUserRow();
    routeQueries(ctx.queryMock, [
      { sql: SELECT_USER_BY_EMAIL, result: [] },
      { sql: SELECT_USER_BY_USERNAME, result: [] },
      { sql: INSERT_USER, result: { insertId: 1 } },
      { sql: INSERT_DEFAULT_SETTINGS, result: {} },
      { sql: SELECT_USER_BY_ID, result: [user] }
    ]);
    const res = await request(ctx.server)
      .post("/api/auth/register")
      .send({ email: user.email, username: user.username, password: "secret123" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, http_code: 201 });
    expect(res.body.data.user).toMatchObject({ id: 1, email: user.email, role: "user" });
    expect(typeof res.body.data.token).toBe("string");
  });

  test("validation failure: missing password → 422 envelope", async () => {
    const res = await request(ctx.server)
      .post("/api/auth/register")
      .send({ email: "a@b.c", username: "abc" });
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ success: false, http_code: 422, data: null });
  });

  test("duplicate email → 409", async () => {
    routeQueries(ctx.queryMock, [{ sql: SELECT_USER_BY_EMAIL, result: [makeUserRow()] }]);
    const res = await request(ctx.server)
      .post("/api/auth/register")
      .send({ email: "tester@example.com", username: "other", password: "secret123" });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });
});

describe("POST /api/auth/login", () => {
  test("success: valid credentials → token + profile", async () => {
    const { hashPassword } = await import("../utils/auth.js");
    const user = makeUserRow({ password_hash: await hashPassword("secret123") });
    routeQueries(ctx.queryMock, [{ sql: SELECT_USER_BY_EMAIL, result: [user] }]);
    const res = await request(ctx.server)
      .post("/api/auth/login")
      .send({ email: user.email, password: "secret123" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.username).toBe("tester");
    expect(typeof res.body.data.token).toBe("string");
  });

  test("auth failure: wrong password → 401", async () => {
    const { hashPassword } = await import("../utils/auth.js");
    const user = makeUserRow({ password_hash: await hashPassword("rightpass1") });
    routeQueries(ctx.queryMock, [{ sql: SELECT_USER_BY_EMAIL, result: [user] }]);
    const res = await request(ctx.server)
      .post("/api/auth/login")
      .send({ email: user.email, password: "wrongpass1" });
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, http_code: 401, data: null });
  });

  test("validation failure: empty body → 422", async () => {
    const res = await request(ctx.server).post("/api/auth/login").send({});
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });
});

describe("POST /api/auth/me", () => {
  test("success: valid token → profile + has_settings", async () => {
    routeQueries(ctx.queryMock, [
      { sql: SELECT_USER_BY_ID, result: [makeUserRow()] },
      { sql: SELECT_SETTINGS_BY_USER, result: [makeSettingsRow()] }
    ]);
    const token = ctx.signToken(USER_TOKEN_CLAIMS);
    const res = await request(ctx.server)
      .post("/api/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(1);
    expect(res.body.data.has_settings).toBe(true);
  });

  test("auth failure: no token → 401 envelope", async () => {
    const res = await request(ctx.server).post("/api/auth/me").send({});
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, http_code: 401, data: null });
  });
});
