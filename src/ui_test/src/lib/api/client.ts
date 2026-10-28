import type { ApiEnvelope } from "./types";

const TOKEN_STORAGE_KEY = "animedy.jwt";

/** Error thrown when the backend returns `success: false` or the network fails. */
export class ApiError extends Error {
  readonly httpCode: number;

  constructor(message: string, httpCode: number) {
    super(message);
    this.name = "ApiError";
    this.httpCode = httpCode;
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token === null) {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } else {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }
}

/**
 * POST `body` to an `/api/...` route and unwrap the standard envelope.
 * All Animedy endpoints are POST; pass `{}` when there are no parameters.
 * Throws `ApiError` on `success: false`, non-JSON responses, or network failure.
 */
const API_BASE = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  (import.meta.env.VITE_API_URL as string | undefined) ??
  ""
).replace(/\/+$/, "");

export async function apiPost<T>(route: string, body: object = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getStoredToken();
  if (token !== null) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const targetUrl = route.startsWith("http") ? route : `${API_BASE}${route}`;

  let envelope: ApiEnvelope<T>;
  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError("Network error — check your connection and try again.", 0);
  }

  if (!envelope.success) {
    throw new ApiError(envelope.message || "Request failed.", envelope.http_code);
  }
  return envelope.data as T;
}
