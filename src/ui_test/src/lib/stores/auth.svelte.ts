import { apiPost, ApiError, getStoredToken, setStoredToken } from "$lib/api/client";
import type {
  AuthLoginRequest,
  AuthMeResponse,
  AuthRegisterRequest,
  AuthTokenResponse,
  UserProfile
} from "$lib/api/types";

/**
 * Auth/session store (Svelte 5 runes). JWT persisted to localStorage;
 * profile re-validated against /api/auth/me on startup via `restore()`.
 */
class AuthStore {
  token = $state<string | null>(getStoredToken());
  user = $state<UserProfile | null>(null);
  loading = $state<boolean>(false);
  error = $state<string | null>(null);
  readonly isLoggedIn = $derived(this.token !== null && this.user !== null);
  readonly isAdmin = $derived(this.user?.role === "admin");

  /** Validate a persisted token on app start; clears it if invalid/expired. */
  async restore(): Promise<void> {
    if (this.token !== null) {
      this.loading = true;
      try {
        const me = await apiPost<AuthMeResponse>("/api/auth/me");
        this.user = me.user;
      } catch (err) {
        if (err instanceof ApiError && err.httpCode === 0) {
          // Offline — keep the token; profile will load when back online.
          this.user = null;
        } else {
          this.clearSession();
        }
      } finally {
        this.loading = false;
      }
    }
  }

  async login(body: AuthLoginRequest): Promise<boolean> {
    return this.authenticate("/api/auth/login", body);
  }

  async register(body: AuthRegisterRequest): Promise<boolean> {
    return this.authenticate("/api/auth/register", body);
  }

  logout(): void {
    this.clearSession();
  }

  private async authenticate(route: string, body: object): Promise<boolean> {
    let ok = false;
    this.loading = true;
    this.error = null;
    try {
      const res = await apiPost<AuthTokenResponse>(route, body);
      this.token = res.token;
      this.user = res.user;
      setStoredToken(res.token);
      ok = true;
    } catch (err) {
      this.error = err instanceof ApiError ? err.message : "Unexpected error.";
    } finally {
      this.loading = false;
    }
    return ok;
  }

  private clearSession(): void {
    this.token = null;
    this.user = null;
    this.error = null;
    setStoredToken(null);
  }
}

export const auth = new AuthStore();
