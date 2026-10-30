// Server 3: real stream resolver backed by @consumet/extensions (Hianime
// provider, wrapped by the Anilist meta-provider so lookups use the same
// AniList id already used by the other servers in Watch.svelte).
import { META, ANIME } from "@consumet/extensions";
import type { IAnimeEpisode, ISource } from "@consumet/extensions";

export type Server3ErrorCode =
  | "ANIME_NOT_FOUND"
  | "EPISODE_NOT_FOUND"
  | "NO_STREAM"
  | "PROVIDER_FAILURE"
  | "TIMEOUT";

export class Server3ResolverError extends Error {
  readonly code: Server3ErrorCode;

  constructor(code: Server3ErrorCode, message: string) {
    super(message);
    this.name = "Server3ResolverError";
    this.code = code;
  }
}

export interface Server3Stream {
  streamUrl: string;
  isM3U8: boolean;
  headers: Record<string, string>;
  subtitles: { lang: string; url: string }[];
}

const RESOLVE_TIMEOUT_MS = 15_000;

let provider: InstanceType<typeof META.Anilist> | null = null;

function getProvider() {
  if (!provider) {
    provider = new META.Anilist(new ANIME.Hianime());
  }
  return provider;
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Server3ResolverError("TIMEOUT", "The streaming provider took too long to respond"));
    }, RESOLVE_TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export async function resolveServer3Stream(anilistId: number, episodeNumber: number): Promise<Server3Stream> {
  const anilist = getProvider();

  let episodeList: IAnimeEpisode[];
  try {
    episodeList = await withTimeout(anilist.fetchEpisodesListById(String(anilistId)));
  } catch (err) {
    if (err instanceof Server3ResolverError) throw err;
    throw new Server3ResolverError("ANIME_NOT_FOUND", "Could not find this anime on the streaming provider");
  }

  if (!episodeList || episodeList.length === 0) {
    throw new Server3ResolverError("ANIME_NOT_FOUND", "Could not find this anime on the streaming provider");
  }

  const episode = episodeList.find((e) => e.number === episodeNumber);
  if (!episode) {
    throw new Server3ResolverError("EPISODE_NOT_FOUND", `Episode ${episodeNumber} is not available on the streaming provider`);
  }

  let source: ISource;
  try {
    source = await withTimeout(anilist.fetchEpisodeSources(episode.id));
  } catch (err) {
    if (err instanceof Server3ResolverError) throw err;
    throw new Server3ResolverError("PROVIDER_FAILURE", "The streaming provider failed to return a video source");
  }

  const sources = source?.sources ?? [];
  const best =
    sources.find((s) => s.isM3U8 && s.quality?.toLowerCase().includes("1080")) ??
    sources.find((s) => s.isM3U8) ??
    sources[0];

  if (!best?.url) {
    throw new Server3ResolverError("NO_STREAM", "No playable stream was returned for this episode");
  }

  return {
    streamUrl: best.url,
    isM3U8: Boolean(best.isM3U8 || best.url.includes(".m3u8")),
    headers: source.headers ?? {},
    subtitles: (source.subtitles ?? [])
      .filter((s): s is { url: string; lang: string } => Boolean(s.url && s.lang))
      .map((s) => ({ lang: s.lang, url: s.url })),
  };
}
