// Account session store — current user, sign-in/sign-up/sign-out, and the
// post-auth sync kick-off. Token + user are persisted in localStorage (see
// api/account.ts) so the session survives reloads and PWA restarts.

import {
  apiLogin,
  apiRegister,
  apiMe,
  apiCheckUsername,
  setSession,
  clearSession,
  loadStoredUser,
  hasToken,
  type AuthUser
} from "$lib/api/account";
import { syncAfterAuth, clearLocalAccountData } from "$lib/sync/migrate.svelte";

class AuthStore {
  user = $state<AuthUser | null>(loadStoredUser());
  /** True while the post-auth cloud sync (migration/pull) is running. */
  syncing = $state(false);

  get isLoggedIn(): boolean {
    return this.user !== null && hasToken();
  }

  get isAdmin(): boolean {
    return this.isLoggedIn && this.user?.role === "admin";
  }

  async register(input: {
    email: string;
    username: string;
    password: string;
    turnstile_token?: string;
  }): Promise<void> {
    const { user, token } = await apiRegister(input);
    setSession(token, user);
    this.user = user;
    await this.runSync(user.id, true);
  }

  async login(input: {
    email: string;
    password: string;
    turnstile_token?: string;
  }): Promise<void> {
    const { user, token } = await apiLogin(input);
    setSession(token, user);
    this.user = user;
    await this.runSync(user.id, false);
  }

  logout(): void {
    clearSession();
    this.user = null;
    clearLocalAccountData();
  }

  /** Refresh the profile from the server; signs out on an invalid token. */
  async refresh(): Promise<void> {
    if (!hasToken()) {
      this.user = null;
      return;
    }
    try {
      const { user } = await apiMe();
      this.user = user;
      setSession(localStorage.getItem("animedy.auth_token") ?? "", user);
    } catch (err) {
      // 401 = expired/invalid token; network errors keep the cached session.
      if (err instanceof Error && "httpCode" in err && (err as { httpCode: number }).httpCode === 401) {
        this.logout();
      }
    }
  }

  checkUsername(username: string): Promise<{ available: boolean }> {
    return apiCheckUsername(username);
  }

  private async runSync(userId: number, freshAccount: boolean): Promise<void> {
    this.syncing = true;
    try {
      await syncAfterAuth(userId, freshAccount);
    } finally {
      this.syncing = false;
    }
  }
}

export const auth = new AuthStore();
