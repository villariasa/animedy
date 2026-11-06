// Account session store — current user, sign-in/sign-up/sign-out, and the
// post-auth sync kick-off. Token + user are persisted in localStorage (see
// api/account.ts) so the session survives reloads and PWA restarts.

import {
  apiLogin,
  apiRegister,
  apiMe,
  apiCheckUsername,
  apiUploadAvatar,
  apiDeleteAvatar,
  setSession,
  clearSession,
  loadStoredUser,
  hasToken,
  type AuthUser
} from "$lib/api/account";
import { syncAfterAuth, clearLocalAccountData } from "$lib/sync/migrate.svelte";
import { notificationHistory } from "$lib/stores/notificationHistory.svelte";

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
  }): Promise<void> {
    const { user, token } = await apiRegister(input);
    setSession(token, user);
    this.user = user;
    // Personal welcome in THIS account's notification bell only — it's a
    // local entry, never synced anywhere, so nobody else can see it.
    notificationHistory.add({
      id: `welcome:${user.id}`,
      type: "system",
      anime_id: null,
      url: "/",
      title: `Welcome to Animedy, ${user.username}!`,
      message:
        "Your account is ready — likes, lists, watch progress and settings now follow you to any device. Enjoy the shows!",
      cover: null,
      created_at: new Date().toISOString()
    });
    // Cloud sync runs in the background — the caller navigates home
    // immediately instead of staring at the form until it finishes.
    void this.runSync(user.id, true);
  }

  async login(input: { email: string; password: string }): Promise<void> {
    const { user, token } = await apiLogin(input);
    setSession(token, user);
    this.user = user;
    void this.runSync(user.id, false);
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

  async updateAvatar(file: File): Promise<string> {
    const { avatar_url } = await apiUploadAvatar(file);
    if (this.user) {
      this.user = { ...this.user, avatar_url };
      const token = localStorage.getItem("animedy.auth_token") ?? "";
      setSession(token, this.user);
    }
    return avatar_url;
  }

  async removeAvatar(): Promise<void> {
    await apiDeleteAvatar();
    if (this.user) {
      this.user = { ...this.user, avatar_url: null };
      const token = localStorage.getItem("animedy.auth_token") ?? "";
      setSession(token, this.user);
    }
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
