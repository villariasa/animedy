/**
 * Seasonal holiday decoration manager.
 * 
 * Automatically activates during the holiday season (Dec 1 through Jan 7)
 * while allowing users to override (Always On / Off / Auto) via settings or local storage.
 */

const STORAGE_KEY = "animedy.seasonal_decorations";

export type HolidayPreference = "auto" | "on" | "off";

function getStoredPreference(): HolidayPreference {
  if (typeof localStorage === "undefined") return "auto";
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === "on" || val === "off" || val === "auto") {
      return val;
    }
  } catch {
    // fallback
  }
  return "auto";
}

/**
 * Returns true if the current date falls between Dec 1 and Jan 7 (inclusive).
 */
export function isHolidaySeasonDate(now = new Date()): boolean {
  const month = now.getMonth(); // 0-indexed: 11 = December, 0 = January
  const date = now.getDate();
  if (month === 11) {
    // December 1-31
    return true;
  }
  if (month === 0 && date <= 7) {
    // January 1-7
    return true;
  }
  return false;
}

class SeasonalStore {
  preference = $state<HolidayPreference>(getStoredPreference());

  /**
   * Whether the Christmas / Holiday decorations should be displayed.
   */
  isActive = $derived.by(() => {
    if (this.preference === "on") return true;
    if (this.preference === "off") return false;
    return isHolidaySeasonDate();
  });

  setPreference(pref: HolidayPreference): void {
    this.preference = pref;
    try {
      localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      // storage unavailable
    }
  }
}

export const seasonal = new SeasonalStore();

