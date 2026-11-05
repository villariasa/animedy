import type { PagesFunction, UserRow } from "../_lib/types";
import { ok, fail, readJson } from "../_lib/http";
import { sha256Hex } from "../_lib/auth";
import { verifyTurnstile } from "../_lib/turnstile";
import { notifyAdmins } from "../_lib/push";

/**
 * Admin-approved password reset — request + status check.
 *
 * No email sending exists, so approval works out-of-band: the requesting
 * device generates a random secret (kept in its localStorage, only the
 * SHA-256 goes to the server). The admin approves the request from the
 * dashboard, and only the device holding the secret can then set a new
 * password (see forgot-reset.ts). Approved requests expire after 24h.
 */

// POST /api/auth/forgot — body: { identifier, client_secret, turnstile_token? }
export const onRequestPost: PagesFunction = async (context) => {
  const { env } = context;
  const body = await readJson(context.request);

  if (!(await verifyTurnstile(env, body.turnstile_token, context.request))) {
    return fail("Verification challenge failed — please try again", 403);
  }

  const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
  const clientSecret = typeof body.client_secret === "string" ? body.client_secret : "";
  if (!identifier) return fail("Enter your username or email", 422);
  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(clientSecret)) return fail("Invalid request", 422);

  const user = await env.DB.prepare(
    `SELECT id, username FROM users WHERE email = ? OR username = ? LIMIT 1`
  )
    .bind(identifier, identifier)
    .first<Pick<UserRow, "id" | "username">>();

  // Don't reveal whether the account exists — always report success.
  if (user) {
    const secretHash = await sha256Hex(clientSecret);
    await env.DB.prepare(
      `INSERT INTO password_resets (user_id, secret_hash, status, requested_at, resolved_at)
       VALUES (?, ?, 'pending', CURRENT_TIMESTAMP, NULL)
       ON CONFLICT (user_id) DO UPDATE SET
         secret_hash = excluded.secret_hash,
         status = 'pending',
         requested_at = CURRENT_TIMESTAMP,
         resolved_at = NULL`
    )
      .bind(user.id, secretHash)
      .run();

    // Wake the admin's devices (PWA push works even with the app closed).
    context.waitUntil(notifyAdmins(env, env.DB));
  }

  return ok(
    { requested: true },
    "Request submitted — the site admin has to approve it, then come back here to set a new password",
    200
  );
};

// GET /api/auth/forgot?identifier=X — status for the requesting device.
// The device secret travels in the X-Reset-Secret header, NOT the URL, so it
// never lands in access logs or browser history.
export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const identifier = url.searchParams.get("identifier")?.trim() ?? "";
  const clientSecret = context.request.headers.get("X-Reset-Secret") ?? "";
  if (!identifier || !clientSecret) return fail("Missing parameters", 422);

  const secretHash = await sha256Hex(clientSecret);
  const row = await context.env.DB.prepare(
    `SELECT pr.status, pr.resolved_at,
            (pr.status = 'approved' AND pr.resolved_at >= datetime('now', '-24 hours')) AS claimable
     FROM password_resets pr
     JOIN users u ON u.id = pr.user_id
     WHERE (u.email = ? OR u.username = ?) AND pr.secret_hash = ?
     LIMIT 1`
  )
    .bind(identifier, identifier, secretHash)
    .first<{ status: string; claimable: number }>();

  if (!row) return ok({ status: "none" }, "No matching request from this device", 200);
  const status = row.status === "approved" && row.claimable !== 1 ? "expired" : row.status;
  return ok({ status }, "Status retrieved", 200);
};
