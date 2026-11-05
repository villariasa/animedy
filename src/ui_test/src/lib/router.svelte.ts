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
  | { name: "admin" }
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
  } else if (path === "/admin") {
    route = { name: "admin" };
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
