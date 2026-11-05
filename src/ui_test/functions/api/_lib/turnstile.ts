// Cloudflare Turnstile server-side verification. Enforcement is opt-in:
// until TURNSTILE_SECRET is set in the Pages project env, tokens are not
// required so the auth flow keeps working during setup.

import type { Env } from "./types";

export async function verifyTurnstile(
  env: Env & { TURNSTILE_SECRET?: string },
  token: unknown,
  request: Request
): Promise<boolean> {
  if (!env.TURNSTILE_SECRET) return true;
  if (typeof token !== "string" || !token) return false;

  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET);
  form.append("response", token);
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) form.append("remoteip", ip);

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
    });
    const outcome = (await res.json()) as { success?: boolean };
    return outcome.success === true;
  } catch {
    return false;
  }
}
