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

/** Human status labels: RELEASING → "Ongoing", FINISHED → "Finished Airing". */
export function statusLabel(status: string | null | undefined): string {
  const map: Record<string, string> = {
    RELEASING: "Ongoing",
    FINISHED: "Finished Airing",
    NOT_YET_RELEASED: "Upcoming",
    CANCELLED: "Cancelled",
    HIATUS: "On Hiatus"
  };
  return status ? (map[status] ?? status) : "";
}

/** Tailwind classes for the colored status tag. */
export function statusBadgeClass(status: string | null | undefined): string {
  const map: Record<string, string> = {
    RELEASING: "bg-green-500/15 text-green-400",
    FINISHED: "bg-sky-500/15 text-sky-400",
    NOT_YET_RELEASED: "bg-amber-500/15 text-amber-400",
    CANCELLED: "bg-red-500/15 text-red-400",
    HIATUS: "bg-orange-500/15 text-orange-400"
  };
  return (status && map[status]) || "bg-muted text-muted-foreground";
}

/** "2d 5h" / "4h 12m" / "36m" countdown text from a unix timestamp. */
export function formatCountdown(unixSeconds: number, nowMs: number): string {
  let label = "soon";
  const diff = unixSeconds * 1000 - nowMs;
  if (diff > 0) {
    const m = Math.floor(diff / 60000);
    const d = Math.floor(m / 1440);
    const h = Math.floor((m % 1440) / 60);
    const mm = m % 60;
    label = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${mm}m` : `${mm}m`;
  }
  return label;
}

/** Formats an ISO date "YYYY-MM-DD" to human readable "Month Day, Year" (e.g. "Oct 3, 2002"). */
export function formatAirDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const parts = dateStr.split("-");
  const yStr = parts[0];
  const mStr = parts[1];
  const dStr = parts[2];
  if (yStr && mStr && dStr) {
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10) - 1;
    const d = parseInt(dStr, 10);
    const dt = new Date(y, m, d);
    if (!isNaN(dt.getTime())) {
      return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
  }
  return dateStr;
}
