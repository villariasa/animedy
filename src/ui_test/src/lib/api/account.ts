// Client for the Cloudflare Pages Functions account/sync API (/api/auth/*,
// /api/sync/*, /api/activity, /api/admin/*). Token lives in localStorage so
// this module has no store dependencies — stores import it for write-through
// sync without creating an import cycle.

import { ApiError } from "./client";

export const AUTH_TOKEN_KEY = "animedy.auth_token";
export const AUTH_USER_KEY = "animedy.auth_user";
const CLIENT_ID_KEY = "animedy.client_id";

/** Turnstile site key (public by design). Server-side enforcement activates
 * once TURNSTILE_SECRET is set in the Pages project env. */
export const TURNSTILE_SITE_KEY = "0x4AAAAAAF0hMWYz9vJN4hVW";

export interface AuthUser {
  id: number;
  email: string;
  username: string;
  role: "user" | "admin";
  created_at: string;
}

export interface AnimeMetaInput {
  title_english?: string | null;
  title_romaji?: string | null;
  cover_image?: string | null;
  format?: string | null;
  season_year?: number | null;
}

export interface CloudState {
  likes: Array<AnimeMetaInput & { anime_id: number; liked_at: string }>;
  lists: Array<{ id: number; name: string; created_at: string }>;
  list_entries: Array<AnimeMetaInput & { list_id: number; anime_id: number; added_at: string }>;
  watch_status: Array<AnimeMetaInput & { anime_id: number; status: string; updated_at: string }>;
  settings: Record<string, unknown> | null;
}

export interface AdminSession {
  client_id: string;
  user_id: number | null;
  username: string | null;
  page: string | null;
  anime_id: number | null;
  episode_number: number | null;
  position_seconds: number | null;
  title: string | null;
  cover_image: string | null;
  updated_at: string;
  online: number;
}

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: string;
  created_at: string;
  likes_count: number;
  lists_count: number;
  watching_count: number;
  completed_count: number;
  plan_count: number;
  dropped_count: number;
  last_active_at: string | null;
}

// ---------- token/session helpers ----------

export function getToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function hasToken(): boolean {
  return getToken() !== null;
}

export function setSession(token: string, user: AuthUser): void {
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  } catch {
    // storage disabled
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  } catch {
    // storage disabled
  }
}

export function loadStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

/** Stable anonymous per-device id for the presence heartbeat (guests too). */
export function getClientId(): string {
  try {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = crypto.randomUUID().replace(/-/g, "");
      localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    return "anon" + Math.random().toString(36).slice(2, 14);
  }
}

// ---------- validation shared with the server ----------

export const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

/** Mirrors functions/api/_lib/validate.ts — keep in sync. */
export function passwordProblems(value: string): string | null {
  if (value.length < 10) return "At least 10 characters";
  if (value.length > 128) return "At most 128 characters";
  if (!/[a-z]/.test(value)) return "Add a lowercase letter";
  if (!/[A-Z]/.test(value)) return "Add an uppercase letter";
  if (!/[0-9]/.test(value)) return "Add a digit";
  if (!/[^a-zA-Z0-9]/.test(value)) return "Add a symbol (e.g. ! @ # $)";
  return null;
}

/** Rough 0–4 strength score for the sign-up meter. */
export function passwordStrength(value: string): number {
  if (!value) return 0;
  let score = 0;
  if (value.length >= 10) score++;
  if (value.length >= 14) score++;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
  if (/[0-9]/.test(value) && /[^a-zA-Z0-9]/.test(value)) score++;
  return score;
}

// ---------- request core ----------

interface Envelope<T> {
  success: boolean;
  http_code: number;
  message: string;
  data: T;
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.auth !== false) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(path, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError("Network error", 0);
  }

  let envelope: Envelope<T>;
  try {
    envelope = (await res.json()) as Envelope<T>;
  } catch {
    throw new ApiError(`Unexpected response (${res.status})`, res.status);
  }
  if (!res.ok || !envelope.success) {
    throw new ApiError(envelope.message || `Request failed (${res.status})`, res.status);
  }
  return envelope.data;
}

// ---------- auth ----------

export function apiRegister(input: {
  email: string;
  username: string;
  password: string;
  turnstile_token?: string;
}): Promise<{ user: AuthUser; token: string }> {
  return request("/api/auth/register", { method: "POST", body: input, auth: false });
}

export function apiLogin(input: {
  email: string;
  password: string;
  turnstile_token?: string;
}): Promise<{ user: AuthUser; token: string }> {
  return request("/api/auth/login", { method: "POST", body: input, auth: false });
}

export function apiMe(): Promise<{ user: AuthUser }> {
  return request("/api/auth/me");
}

export function apiCheckUsername(username: string): Promise<{ available: boolean }> {
  return request(`/api/auth/check-username?username=${encodeURIComponent(username)}`, {
    auth: false,
  });
}

// ---------- sync ----------

export function apiFetchAll(): Promise<CloudState> {
  return request("/api/sync/all");
}

export function apiMigrate(payload: unknown): Promise<CloudState> {
  return request("/api/sync/migrate", { method: "POST", body: payload });
}

export function apiPutLike(animeId: number, meta: AnimeMetaInput & { liked_at?: string }): Promise<unknown> {
  return request(`/api/sync/likes/${animeId}`, { method: "PUT", body: meta });
}

export function apiDeleteLike(animeId: number): Promise<unknown> {
  return request(`/api/sync/likes/${animeId}`, { method: "DELETE" });
}

export function apiCreateList(name: string): Promise<{ id: number; name: string }> {
  return request("/api/sync/lists", { method: "POST", body: { name } });
}

export function apiRenameList(listId: number, name: string): Promise<unknown> {
  return request(`/api/sync/lists/${listId}`, { method: "PATCH", body: { name } });
}

export function apiDeleteList(listId: number): Promise<unknown> {
  return request(`/api/sync/lists/${listId}`, { method: "DELETE" });
}

export function apiAddListEntry(
  listId: number,
  animeId: number,
  meta: AnimeMetaInput & { added_at?: string }
): Promise<unknown> {
  return request(`/api/sync/lists/${listId}/${animeId}`, { method: "PUT", body: meta });
}

export function apiRemoveListEntry(listId: number, animeId: number): Promise<unknown> {
  return request(`/api/sync/lists/${listId}/${animeId}`, { method: "DELETE" });
}

export function apiPutWatchStatus(
  animeId: number,
  status: string,
  meta: AnimeMetaInput
): Promise<unknown> {
  return request(`/api/sync/watch-status/${animeId}`, {
    method: "PUT",
    body: { status, ...meta },
  });
}

export function apiDeleteWatchStatus(animeId: number): Promise<unknown> {
  return request(`/api/sync/watch-status/${animeId}`, { method: "DELETE" });
}

export function apiPutSettings(settings: Record<string, unknown>): Promise<unknown> {
  return request("/api/sync/settings", { method: "PUT", body: settings });
}

// ---------- presence / admin ----------

export function apiHeartbeat(payload: {
  client_id: string;
  page: string;
  anime_id?: number | null;
  episode_number?: number | null;
  position_seconds?: number | null;
  title?: string | null;
  cover_image?: string | null;
}): Promise<unknown> {
  return request("/api/activity", { method: "POST", body: payload });
}

export function apiAdminActivity(): Promise<{ sessions: AdminSession[]; now: string }> {
  return request("/api/admin/activity");
}

export function apiAdminUsers(): Promise<{ users: AdminUser[] }> {
  return request("/api/admin/users");
}
