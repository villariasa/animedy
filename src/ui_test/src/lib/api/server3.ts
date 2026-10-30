// Server 3: real stream resolver. Calls our own backend (src/animedy_v1/routes/server3.ts),
// which resolves the episode via @consumet/extensions and relays the actual
// .m3u8 through a signed same-origin proxy so hls.js can play it directly.
const SERVER3_RESOLVE_URL = "/api/server3/resolve";
const FETCH_TIMEOUT_MS = 20_000;

export class Server3Error extends Error {
  readonly httpCode: number;

  constructor(message: string, httpCode: number) {
    super(message);
    this.name = "Server3Error";
    this.httpCode = httpCode;
  }
}

export interface Server3StreamResult {
  streamUrl: string;
  isM3U8: boolean;
  subtitles: { lang: string; url: string }[];
}

interface Server3ApiResponse {
  success: boolean;
  message: string;
  data: {
    stream_url: string;
    is_m3u8: boolean;
    subtitles: { lang: string; url: string }[];
  } | null;
}

export async function resolveServer3Stream(animeId: number, episodeNumber: number): Promise<Server3StreamResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(SERVER3_RESOLVE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anime_id: animeId, episode_number: episodeNumber }),
      signal: controller.signal,
    });
  } catch {
    throw new Server3Error("Could not reach the streaming backend", 0);
  } finally {
    clearTimeout(timer);
  }

  const body = (await response.json().catch(() => null)) as Server3ApiResponse | null;

  if (!response.ok || !body?.success || !body.data) {
    throw new Server3Error(body?.message ?? "Failed to resolve stream", response.status);
  }

  return {
    streamUrl: body.data.stream_url,
    isM3U8: body.data.is_m3u8,
    subtitles: body.data.subtitles,
  };
}
