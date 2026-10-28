/** "1 h 24 min left" / "12 min left" / "45 s left" from remaining seconds. */
export function formatRemaining(seconds: number): string {
  let label: string;
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) {
    label = `${h} h ${m} min left`;
  } else if (m > 0) {
    label = `${m} min left`;
  } else {
    label = `${s} s left`;
  }
  return label;
}

/** Render external-API HTML descriptions as plain text (XSS-safe): keep
 * <br> line breaks, drop every other tag. */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'");
}

/** Preferred display title: english → romaji → fallback. */
export function displayTitle(english: string | null, romaji: string | null): string {
  return english ?? romaji ?? "Untitled";
}

/** "1:23:45" / "23:45" clock format from seconds. */
export function formatTime(seconds: number): string {
  let label: string;
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  if (h > 0) {
    label = `${h}:${String(m).padStart(2, "0")}:${sec}`;
  } else {
    label = `${m}:${sec}`;
  }
  return label;
}
