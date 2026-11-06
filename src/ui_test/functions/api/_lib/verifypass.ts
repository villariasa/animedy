// Signed "verification pass" — issued after a solved Turnstile challenge on
// the full-page #/verify screen, consumed by the auth endpoints.
//   daily: 24h, reusable, client-side browsing gate.
//   auth:  10min, single-use (nonce burned in verify_nonces) — one pass per
//          sign-in/sign-up attempt.
// Format: v1.<b64url payload>.<b64url hmac-sha256>

import type { D1Database } from "./types";

export type PassPurpose = "daily" | "auth";

interface PassPayload {
  p: PassPurpose;
  n: string;
  exp: number; // unix seconds
}

const TTL_SECONDS: Record<PassPurpose, number> = {
  daily: 24 * 60 * 60,
  auth: 10 * 60,
};

function toB64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(value: string): Uint8Array {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("verifypass:" + secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function issuePass(
  purpose: PassPurpose,
  secret: string
): Promise<{ pass: string; expires_at: number }> {
  const payload: PassPayload = {
    p: purpose,
    n: toB64url(crypto.getRandomValues(new Uint8Array(16))),
    exp: Math.floor(Date.now() / 1000) + TTL_SECONDS[purpose],
  };
  const body = toB64url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  return { pass: `v1.${body}.${toB64url(sig)}`, expires_at: payload.exp };
}

async function parsePass(pass: unknown, secret: string): Promise<PassPayload | null> {
  if (typeof pass !== "string") return null;
  const parts = pass.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  try {
    const key = await hmacKey(secret);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      fromB64url(parts[2]) as BufferSource,
      new TextEncoder().encode(parts[1])
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(parts[1]))) as PassPayload;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (typeof payload.n !== "string" || !payload.n) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Validates an auth pass and burns its nonce — a second use (second sign-in
 * attempt) is rejected, forcing a fresh full-page verification.
 * Enforcement is skipped entirely while TURNSTILE_SECRET is unset, matching
 * the old inline-widget behaviour during setup/local dev.
 */
export async function consumeAuthPass(
  env: { JWT_SECRET: string; TURNSTILE_SECRET?: string; DB: D1Database },
  pass: unknown
): Promise<boolean> {
  if (!env.TURNSTILE_SECRET) return true;
  const payload = await parsePass(pass, env.JWT_SECRET);
  if (!payload || payload.p !== "auth") return false;

  try {
    await env.DB.prepare(`INSERT INTO verify_nonces (nonce) VALUES (?)`).bind(payload.n).run();
  } catch {
    return false; // PK conflict → nonce already used (replay)
  }
  // Opportunistic prune — anything past the 10min auth TTL is garbage.
  await env.DB.prepare(`DELETE FROM verify_nonces WHERE used_at < datetime('now', '-15 minutes')`)
    .run()
    .catch(() => undefined);
  return true;
}
