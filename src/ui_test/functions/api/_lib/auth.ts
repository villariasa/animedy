// WebCrypto-based password hashing (PBKDF2-SHA256) and HS256 JWT —
// Workers-safe, no npm dependencies. Stored hash format:
//   pbkdf2:<iterations>:<salt b64url>:<hash b64url>

import type { Env, PagesContext, UserRow } from "./types";
import { fail } from "./http";

const PBKDF2_ITERATIONS = 100_000;
const JWT_TTL_SECONDS = 7 * 24 * 60 * 60; // 7d, same as the Node backend

export interface JwtClaims {
  user_id: number;
  username: string;
  role: "user" | "admin";
  exp: number;
}

// ---------- base64url ----------

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

// ---------- password hashing ----------

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    256
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2:${PBKDF2_ITERATIONS}:${toB64url(salt)}:${toB64url(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations < 1) return false;
  const salt = fromB64url(parts[2]);
  const expected = fromB64url(parts[3]);
  const actual = await pbkdf2(password, salt, iterations);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

/** SHA-256 hex digest — used to store password-reset device secrets. */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------- JWT (HS256) ----------

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signToken(
  claims: Omit<JwtClaims, "exp">,
  secret: string
): Promise<string> {
  const header = toB64url(new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = toB64url(
    new TextEncoder().encode(
      JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + JWT_TTL_SECONDS })
    )
  );
  const key = await hmacKey(secret);
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${payload}`))
  );
  return `${header}.${payload}.${toB64url(sig)}`;
}

export async function verifyToken(token: string, secret: string): Promise<JwtClaims | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  try {
    const key = await hmacKey(secret);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      fromB64url(signature) as BufferSource,
      new TextEncoder().encode(`${header}.${payload}`)
    );
    if (!valid) return null;
    const claims = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as JwtClaims;
    if (typeof claims.exp !== "number" || claims.exp < Math.floor(Date.now() / 1000)) return null;
    if (typeof claims.user_id !== "number") return null;
    return claims;
  } catch {
    return null;
  }
}

// ---------- request guards ----------

export async function requireAuth(
  context: PagesContext<Record<string, string>>
): Promise<{ claims: JwtClaims } | { response: Response }> {
  const env: Env = context.env;
  if (!env.JWT_SECRET) {
    return { response: fail("JWT_SECRET is not configured", 500) };
  }
  const header = context.request.headers.get("Authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return { response: fail("Missing or malformed Authorization header", 401) };
  }
  const claims = await verifyToken(header.slice("Bearer ".length).trim(), env.JWT_SECRET);
  if (!claims) {
    return { response: fail("Invalid or expired token", 401) };
  }
  return { claims };
}

export async function requireAdmin(
  context: PagesContext<Record<string, string>>
): Promise<{ claims: JwtClaims } | { response: Response }> {
  const auth = await requireAuth(context);
  if ("response" in auth) return auth;
  if (auth.claims.role !== "admin") {
    return { response: fail("Admin role required", 403) };
  }
  return auth;
}

export function toProfile(user: UserRow): {
  id: number;
  email: string;
  username: string;
  role: string;
  avatar_url: string | null;
  created_at: string;
} {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    avatar_url: user.avatar_url ?? null,
    created_at: user.created_at,
  };
}
