// JWT + bcrypt helpers and Hono auth middleware.

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Context, Next } from "hono";
import type { UserRole } from "../interfaces/db.js";
import type { ApiResponse } from "../interfaces/api.js";

const BCRYPT_ROUNDS = 10;
const JWT_EXPIRES_IN = "7d";

export interface JwtClaims {
  user_id: number;
  username: string;
  role: UserRole;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return secret;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signToken(claims: JwtClaims): string {
  return jwt.sign(claims, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN, algorithm: "HS256" });
}

export function verifyToken(token: string): JwtClaims {
  return jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] }) as unknown as JwtClaims;
}

function unauthorizedResponse(message: string): ApiResponse<null> {
  return { success: false, http_code: 401, message, data: null };
}

function forbiddenResponse(message: string): ApiResponse<null> {
  return { success: false, http_code: 403, message, data: null };
}

function extractBearerToken(context: Context): string | null {
  const header = context.req.header("Authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return null;
  }
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

/**
 * Hono middleware requiring a valid Bearer JWT. Attaches decoded claims
 * to context under the "jwtClaims" key.
 */
export async function authRequired(context: Context, next: Next): Promise<Response | void> {
  const token = extractBearerToken(context);
  if (!token) {
    return context.json(unauthorizedResponse("Missing or malformed Authorization header"), 401);
  }

  try {
    const claims = verifyToken(token);
    context.set("jwtClaims", claims);
    await next();
    return undefined;
  } catch {
    return context.json(unauthorizedResponse("Invalid or expired token"), 401);
  }
}

/**
 * Hono middleware requiring the authenticated user to have the 'admin' role.
 * Must run after authRequired.
 */
export async function adminRequired(context: Context, next: Next): Promise<Response | void> {
  const claims = context.get("jwtClaims") as JwtClaims | undefined;
  if (!claims || claims.role !== "admin") {
    return context.json(forbiddenResponse("Admin role required"), 403);
  }
  await next();
  return undefined;
}

export function getClaims(context: Context): JwtClaims {
  return context.get("jwtClaims") as JwtClaims;
}
