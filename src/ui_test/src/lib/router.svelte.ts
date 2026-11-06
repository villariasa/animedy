/**
 * Minimal hash-based router ($state) — the convention stack declares no
 * router library, so routes are plain hashes: #/, #/anime/:id,
 * #/watch/:episodeId, #/history, #/settings.
 */
export type Route =
  | { name: "home" }
  | { name: "anime"; animeId: number }
  | { name: "watch"; animeId: number; episodeId: number }
  | { name: "history" }
  | { name: "favorites" }
  | { name: "mylist" }
  | { name: "stats" }
  | { name: "settings" }
  | { name: "signin" }
  | { name: "signup" }
  | { name: "forgot" }
  | { name: "seasonal"; season?: string; year?: number }
  | { name: "verify"; purpose: "daily" | "auth"; then: string }
  | { name: "admin" }
  | { name: "notfound" };

function parseHash(hash: string): Route {
  let route: Route = { name: "notfound" };
  const raw = hash.replace(/^#/, "") || "/";
  // Only the verify route carries a query string (?purpose=&then=).
  const queryIndex = raw.indexOf("?");
  const path = queryIndex === -1 ? raw : raw.slice(0, queryIndex);
  if (path === "/verify") {
    const params = new URLSearchParams(queryIndex === -1 ? "" : raw.slice(queryIndex + 1));
    const thenParam = params.get("then") ?? "/";
    return {
      name: "verify",
      purpose: params.get("purpose") === "auth" ? "auth" : "daily",
      // Only same-app hash paths are honoured — never external URLs.
      then: thenParam.startsWith("/") ? thenParam : "/"
    };
  }
  const animeMatch = /^\/anime\/(\d+)$/.exec(path);
  const watchMatch = /^\/watch\/(\d+)\/(\d+)$/.exec(path);
  if (path === "/") {
    route = { name: "home" };
  } else if (animeMatch?.[1] !== undefined) {
    route = { name: "anime", animeId: Number(animeMatch[1]) };
  } else if (watchMatch?.[1] !== undefined && watchMatch[2] !== undefined) {
    route = { name: "watch", animeId: Number(watchMatch[1]), episodeId: Number(watchMatch[2]) };
  } else if (path === "/history") {
    route = { name: "history" };
  } else if (path === "/favorites") {
    route = { name: "favorites" };
  } else if (path === "/mylist") {
    route = { name: "mylist" };
  } else if (path === "/stats") {
    route = { name: "stats" };
  } else if (path === "/settings") {
    route = { name: "settings" };
  } else if (path === "/signin") {
    route = { name: "signin" };
  } else if (path === "/signup") {
    route = { name: "signup" };
  } else if (path === "/forgot") {
    route = { name: "forgot" };
  } else if (path === "/seasonal") {
    route = { name: "seasonal" };
  } else if (path === "/admin") {
    route = { name: "admin" };
  } else {
    const seasonalMatch = /^\/seasonal\/(winter|spring|summer|fall)\/(\d{4})$/i.exec(path);
    if (seasonalMatch?.[1] !== undefined && seasonalMatch[2] !== undefined) {
      route = {
        name: "seasonal",
        season: seasonalMatch[1].toUpperCase(),
        year: Number(seasonalMatch[2])
      };
    }
  }
  return route;
}

class Router {
  current = $state<Route>(parseHash(location.hash));

  constructor() {
    window.addEventListener("hashchange", () => {
      this.current = parseHash(location.hash);
    });
  }

  go(path: string): void {
    const newHash = path.startsWith("#") ? path : "#" + path;
    if (location.hash !== newHash) {
      if (typeof document !== "undefined" && document.fullscreenElement) {
        history.replaceState(null, "", newHash);
        this.current = parseHash(newHash);
      } else {
        location.hash = newHash;
      }
    }
  }
}

export const router = new Router();
