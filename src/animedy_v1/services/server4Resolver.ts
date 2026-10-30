// Service to resolve anime episode stream tokens from 9anime.si
export interface Server4StreamResult {
  watchUrl: string;
  streamUrl: string;
}

const cache = new Map<string, string>();
const seriesSlugCache = new Map<string, string>();

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function resolveServer4Stream(
  animeId: number,
  episodeNumber: number,
  titles: string[] = [],
): Promise<Server4StreamResult | null> {
  const cacheKey = `${animeId}-${episodeNumber}`;
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey)!;
    return { watchUrl: `https://9anime.si`, streamUrl: cached };
  }

  const validTitles = [...new Set(titles.filter(Boolean))];
  const candidateSlugs = new Set<string>();

  // 1. Check cached series slug if we already found this anime previously
  const titleKey = validTitles[0] ?? String(animeId);
  const cachedSlug = seriesSlugCache.get(titleKey);
  if (cachedSlug) {
    candidateSlugs.add(cachedSlug);
  }

  // 2. Query 9anime.si search API
  for (const t of validTitles) {
    const clean = t.replace(/[:!?]/g, " ").replace(/\s+/g, " ").trim();
    if (!clean) continue;
    try {
      const sRes = await fetch(
        `https://9anime.si/api/search?q=${encodeURIComponent(clean)}`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
        },
      );
      if (sRes.ok) {
        const data = (await sRes.json()) as { results?: Array<{ slug: string; title: string }> };
        if (data.results && data.results.length > 0) {
          for (const item of data.results.slice(0, 3)) {
            candidateSlugs.add(item.slug);
            seriesSlugCache.set(titleKey, item.slug);
          }
        }
      }
    } catch {
      // ignore
    }

    // Direct slug candidates
    candidateSlugs.add(slugify(t));
    candidateSlugs.add(slugify(clean));
  }

  // 3. Try each candidate watch URL on 9anime.si
  for (const slug of candidateSlugs) {
    if (!slug) continue;
    const watchUrl = `https://9anime.si/watch/${slug}-episode-${episodeNumber}`;
    try {
      const wRes = await fetch(watchUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
      if (wRes.ok) {
        const html = await wRes.text();
        const tokenMatches = [...html.matchAll(/data-token="([^"]+)"/g)];
        for (const m of tokenMatches) {
          const rawToken = m[1];
          if (!rawToken) continue;
          try {
            const decoded = JSON.parse(
              Buffer.from(rawToken, "base64").toString("utf-8"),
            ) as { u?: string };
            if (decoded && decoded.u && decoded.u.startsWith("http")) {
              let streamUrl = decoded.u;

              // If it's a gogoanime wrapper, try to extract the direct inner player
              if (streamUrl.includes("gogoanime.me.uk")) {
                try {
                  const gRes = await fetch(streamUrl, {
                    headers: {
                      "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                      Referer: "https://9anime.si/",
                    },
                  });
                  if (gRes.ok) {
                    const gHtml = await gRes.text();
                    const innerMatch = gHtml.match(/<iframe[^>]*src=["']([^"']+)["']/i);
                    if (innerMatch && innerMatch[1] && innerMatch[1].startsWith("http")) {
                      streamUrl = innerMatch[1];
                    }
                  }
                } catch {
                  // keep decoded.u as fallback
                }
              }

              cache.set(cacheKey, streamUrl);
              seriesSlugCache.set(titleKey, slug);
              return { watchUrl, streamUrl };
            }
          } catch {
            // ignore JSON parse error
          }
        }

        // Check fallback iframe in HTML
        const frameMatch = html.match(
          /<iframe[^>]*class=["']video-frame["'][^>]*src=["']([^"']+)["']/i,
        ) || html.match(/id=["']videoFrame["'][^>]*src=["']([^"']+)["']/i);
        const frameSrc = frameMatch?.[1];
        if (frameSrc && frameSrc.startsWith("http")) {
          cache.set(cacheKey, frameSrc);
          seriesSlugCache.set(titleKey, slug);
          return { watchUrl, streamUrl: frameSrc };
        }
      }
    } catch {
      // try next
    }
  }

  return null;
}
