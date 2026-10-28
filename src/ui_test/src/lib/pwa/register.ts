/** Register the hand-rolled service worker (production builds only —
 * caching the Vite dev server breaks HMR). */
export function registerServiceWorker(): void {
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch((err: unknown) => {
        console.error("Service worker registration failed:", err);
      });
    });
  }
}
