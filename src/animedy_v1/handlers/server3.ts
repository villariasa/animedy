import type { Context } from "hono";
import { logError } from "../../lib/errorlogger.js";
import { ok, fail } from "../lib/response.js";
import { signProxyTarget, verifyProxyToken } from "../lib/server3Proxy.js";
import { server3ResolveSchema } from "../schemas/server3.js";
import { resolveServer3Stream, Server3ResolverError } from "../services/server3Resolver.js";

function statusForErrorCode(code: Server3ResolverError["code"]): 404 | 502 | 504 {
  switch (code) {
    case "ANIME_NOT_FOUND":
    case "EPISODE_NOT_FOUND":
      return 404;
    case "TIMEOUT":
      return 504;
    case "NO_STREAM":
    case "PROVIDER_FAILURE":
    default:
      return 502;
  }
}

function buildProxyUrl(url: string, headers: Record<string, string>): string {
  const token = signProxyTarget({ url, headers });
  return `/api/server3/proxy?t=${encodeURIComponent(token)}`;
}

export async function server3ResolveHandler(context: Context): Promise<Response> {
  try {
    const parsed = server3ResolveSchema.safeParse(await context.req.json().catch(() => ({})));
    if (!parsed.success) {
      return context.json(fail("Invalid request body", 422), 422);
    }

    const stream = await resolveServer3Stream(parsed.data.anime_id, parsed.data.episode_number);

    const responseData = {
      stream_url: buildProxyUrl(stream.streamUrl, stream.headers),
      is_m3u8: stream.isM3U8,
      subtitles: stream.subtitles,
    };
    return context.json(ok(responseData, "Stream resolved"), 200);
  } catch (err) {
    if (err instanceof Server3ResolverError) {
      const status = statusForErrorCode(err.code);
      return context.json(fail(err.message, status), status);
    }
    await logError("server3.resolve", err);
    return context.json(fail("Internal server error", 500), 500);
  }
}

const M3U8_CONTENT_TYPES = ["application/vnd.apple.mpegurl", "application/x-mpegurl", "audio/mpegurl", "audio/x-mpegurl"];

function rewriteM3U8(playlist: string, baseUrl: string, upstreamHeaders: Record<string, string>): string {
  const lines = playlist.split(/\r?\n/);
  const rewritten = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    try {
      const absolute = new URL(trimmed, baseUrl).toString();
      const token = signProxyTarget({ url: absolute, headers: upstreamHeaders });
      return `/api/server3/proxy?t=${encodeURIComponent(token)}`;
    } catch {
      return line;
    }
  });
  return rewritten.join("\n");
}

export async function server3ProxyHandler(context: Context): Promise<Response> {
  const token = context.req.query("t");
  if (!token) {
    return context.json(fail("Missing stream token", 400), 400);
  }

  const target = verifyProxyToken(token);
  if (!target || !target.url.startsWith("https://")) {
    return context.json(fail("Invalid or tampered stream token", 400), 400);
  }

  try {
    const upstreamHeaders: Record<string, string> = { ...target.headers };
    const range = context.req.header("range");
    if (range) upstreamHeaders["Range"] = range;

    const upstreamResponse = await fetch(target.url, { headers: upstreamHeaders });
    if (!upstreamResponse.ok && upstreamResponse.status !== 206) {
      return context.json(fail("Provider refused the stream request", 502), 502);
    }

    const contentType = upstreamResponse.headers.get("content-type") ?? "";
    const isM3U8 = target.url.includes(".m3u8") || M3U8_CONTENT_TYPES.some((t) => contentType.includes(t));

    if (isM3U8) {
      const playlist = await upstreamResponse.text();
      const body = rewriteM3U8(playlist, target.url, target.headers);
      return new Response(body, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const passthroughHeaders = new Headers();
    passthroughHeaders.set("Content-Type", contentType || "application/octet-stream");
    passthroughHeaders.set("Access-Control-Allow-Origin", "*");
    passthroughHeaders.set("Cache-Control", "no-store");
    const contentRange = upstreamResponse.headers.get("content-range");
    if (contentRange) passthroughHeaders.set("Content-Range", contentRange);
    const acceptRanges = upstreamResponse.headers.get("accept-ranges");
    if (acceptRanges) passthroughHeaders.set("Accept-Ranges", acceptRanges);

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: passthroughHeaders,
    });
  } catch (err) {
    await logError("server3.proxy", err);
    return context.json(fail("Failed to relay stream from provider", 502), 502);
  }
}
