// Casual deterrent only — NOT security. Right-click/shortcut blocking is
// trivially bypassed (browser menu → "Inspect", disabling JS, a userscript,
// or just opening DevTools before the page loads) and some browsers ignore
// contextmenu.preventDefault() entirely. The only things that actually keep
// data safe from inspection are: never shipping secrets to the client (see
// check-secrets.mjs) and never trusting client-side checks for anything
// security-sensitive. This only exists to raise friction for casual
// "right click → view source" users, nothing more.
const BLOCKED_KEY_COMBOS: Array<(e: KeyboardEvent) => boolean> = [
  (e) => e.key === "F12",
  (e) => e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i"),
  (e) => e.ctrlKey && e.shiftKey && (e.key === "J" || e.key === "j"),
  (e) => e.ctrlKey && e.shiftKey && (e.key === "C" || e.key === "c"),
  (e) => e.ctrlKey && (e.key === "U" || e.key === "u"),
  (e) => e.metaKey && e.altKey && (e.key === "I" || e.key === "i") // Safari devtools
];

export function installInspectGuard(): void {
  if (typeof document === "undefined") return;

  document.addEventListener("contextmenu", (e) => {
    e.preventDefault();
  });

  document.addEventListener("keydown", (e) => {
    if (BLOCKED_KEY_COMBOS.some((test) => test(e))) {
      e.preventDefault();
    }
  });
}
