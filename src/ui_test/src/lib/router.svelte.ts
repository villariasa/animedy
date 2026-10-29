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
  | { name: "settings" }
  | { name: "notfound" };

function parseHash(hash: string): Route {
  let route: Route = { name: "notfound" };
  const path = hash.replace(/^#/, "") || "/";
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
  } else if (path === "/settings") {
    route = { name: "settings" };
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
    location.hash = path;
  }
}

export const router = new Router();
