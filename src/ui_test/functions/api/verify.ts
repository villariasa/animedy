import type { PagesFunction } from "./_lib/types";
import { ok, fail, readJson } from "./_lib/http";
import { verifyTurnstile } from "./_lib/turnstile";
import { issuePass, type PassPurpose } from "./_lib/verifypass";

/** Full-page verification (#/verify) exchanges a solved Turnstile challenge
 * for a signed pass: "daily" (24h browsing) or "auth" (10min, single-use,
 * required by login/register/forgot). With TURNSTILE_SECRET unset the pass is
 * issued unconditionally so dev and pre-setup deploys keep working. */
export const onRequestPost: PagesFunction = async (context) => {
  const { env } = context;
  if (!env.JWT_SECRET) return fail("JWT_SECRET is not configured", 500);

  const body = await readJson(context.request);
  const purpose: PassPurpose = body.purpose === "auth" ? "auth" : "daily";

  if (!(await verifyTurnstile(env, body.turnstile_token, context.request))) {
    return fail("Verification challenge failed — please try again", 403);
  }

  const { pass, expires_at } = await issuePass(purpose, env.JWT_SECRET);
  // One solved challenge also refreshes the daily browsing pass, so a sign-in
  // on first visit of the day is a single check, not two back-to-back.
  if (purpose === "auth") {
    const daily = await issuePass("daily", env.JWT_SECRET);
    return ok(
      { pass, expires_at, purpose, daily_pass: daily.pass, daily_expires_at: daily.expires_at },
      "Verified",
      200
    );
  }
  return ok({ pass, expires_at, purpose }, "Verified", 200);
};
