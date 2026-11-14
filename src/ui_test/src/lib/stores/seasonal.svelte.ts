/**
 * Admin-controlled Christmas & Holiday Seasonal Theme.
 *
 * Enabled by default across the entire website so all visitors experience
 * the festive holiday decorations immediately.
 * Only administrators can disable or enable this theme via the Admin panel.
 */

const ADMIN_STORAGE_KEY = "animedy.admin_christmas_theme";

function getAdminHolidaySetting(): boolean {
  if (typeof localStorage === "undefined") return true;
  try {
    const val = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (val === "false" || val === "disabled") {
      return false;
    }
  } catch {
    // default to true
  }
  return true;
}

class SeasonalStore {
  // Enabled by default for all visitors
  enabled = $state<boolean>(getAdminHolidaySetting());

  isActive = $derived(this.enabled);

  /**
   * Only admin can toggle the site-wide Christmas theme.
   */
  setAdminEnabled(enabled: boolean): void {
    this.enabled = enabled;
    try {
      localStorage.setItem(ADMIN_STORAGE_KEY, enabled ? "true" : "false");
    } catch {
      // storage unavailable
    }
  }
}

export const seasonal = new SeasonalStore();
