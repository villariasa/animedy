// Web Push sender (payload-less) with VAPID auth — no npm dependencies.
//
// We deliberately send pushes WITHOUT a payload: the service worker wakes up
// and shows a generic "open the admin dashboard" notification. This skips the
// RFC 8291 payload-encryption dance entirely — only the VAPID ES256 JWT is
// needed, which WebCrypto handles natively. Requires the VAPID_PRIVATE_JWK
// env secret (pairs with VAPID_PUBLIC_KEY in src/lib/push.ts).

import type { D1Database, Env } from "./types";

function toB64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function vapidJwt(privateJwk: string, audience: string): Promise<string> {
  const jwk = JSON.parse(privateJwk) as JsonWebKey;
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const enc = new TextEncoder();
  const header = toB64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = toB64url(
    enc.encode(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: "mailto:admin@animedy.pages.dev",
      })
    )
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${header}.${payload}`))
  );
  return `${header}.${payload}.${toB64url(sig)}`;
}

interface PushEnv extends Env {
  VAPID_PRIVATE_JWK?: string;
  VAPID_PUBLIC_KEY?: string;
}

interface SubscriptionRow {
  id: number;
  endpoint: string;
}

/** Fires a payload-less push to one endpoint. Returns false when the push
 * service says the subscription is gone (404/410) so the caller can prune. */
async function sendPush(env: PushEnv, endpoint: string): Promise<boolean> {
  if (!env.VAPID_PRIVATE_JWK || !env.VAPID_PUBLIC_KEY) return true;
  const audience = new URL(endpoint).origin;
  const jwt = await vapidJwt(env.VAPID_PRIVATE_JWK, audience);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        TTL: "86400",
        Urgency: "high",
        Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
      },
    });
    return res.status !== 404 && res.status !== 410;
  } catch {
    return true; // transient network error — keep the subscription
  }
}

/** Pushes a wake-up to every admin device subscription; prunes dead ones. */
export async function notifyAdmins(env: Env, db: D1Database): Promise<void> {
  const subs = await db
    .prepare(
      `SELECT ps.id, ps.endpoint
       FROM push_subscriptions ps
       JOIN users u ON u.id = ps.user_id
       WHERE u.role = 'admin'`
    )
    .all<SubscriptionRow>();

  const dead: number[] = [];
  await Promise.all(
    subs.results.map(async (sub) => {
      const alive = await sendPush(env as PushEnv, sub.endpoint);
      if (!alive) dead.push(sub.id);
    })
  );
  for (const id of dead) {
    await db.prepare(`DELETE FROM push_subscriptions WHERE id = ?`).bind(id).run();
  }
}
