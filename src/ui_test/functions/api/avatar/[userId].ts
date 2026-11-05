import type { PagesFunction } from "../_lib/types";
import { asInt } from "../_lib/validate";

export const onRequestGet: PagesFunction<{ userId: string }> = async (context) => {
  const userId = asInt(context.params.userId);
  if (!userId) {
    return new Response("Invalid user id", { status: 400 });
  }

  const r2 = context.env.AVATARS;
  if (!r2) {
    return new Response("Avatar storage not configured", { status: 503 });
  }

  // Look for avatar object in R2
  const object = await r2.get(`avatars/${userId}`);
  if (!object) {
    return new Response("Avatar not found", {
      status: 404,
      headers: {
        "Cache-Control": "public, max-age=60",
      },
    });
  }

  const contentType = object.httpMetadata?.contentType || "image/jpeg";
  return new Response(object.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
};
