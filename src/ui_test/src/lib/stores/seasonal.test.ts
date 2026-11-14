import { describe, expect, test } from "vitest";
import { isHolidaySeasonDate, seasonal } from "./seasonal.svelte";

describe("seasonal holiday store", () => {
  test("isHolidaySeasonDate identifies December as holiday season", () => {
    // Dec 1
    const dec1 = new Date(2026, 11, 1);
    expect(isHolidaySeasonDate(dec1)).toBe(true);

    // Dec 25
    const dec25 = new Date(2026, 11, 25);
    expect(isHolidaySeasonDate(dec25)).toBe(true);
  });

  test("isHolidaySeasonDate identifies early January as holiday season", () => {
    // Jan 5
    const jan5 = new Date(2027, 0, 5);
    expect(isHolidaySeasonDate(jan5)).toBe(true);

    // Jan 7
    const jan7 = new Date(2027, 0, 7);
    expect(isHolidaySeasonDate(jan7)).toBe(true);

    // Jan 8 (past holiday season)
    const jan8 = new Date(2027, 0, 8);
    expect(isHolidaySeasonDate(jan8)).toBe(false);
  });

  test("isHolidaySeasonDate returns false for other months", () => {
    // July 15
    const jul15 = new Date(2026, 6, 15);
    expect(isHolidaySeasonDate(jul15)).toBe(false);

    // November 20
    const nov20 = new Date(2026, 10, 20);
    expect(isHolidaySeasonDate(nov20)).toBe(false);
  });

  test("preference override works", () => {
    seasonal.setPreference("on");
    expect(seasonal.preference).toBe("on");
    expect(seasonal.isActive).toBe(true);

    seasonal.setPreference("off");
    expect(seasonal.preference).toBe("off");
    expect(seasonal.isActive).toBe(false);

    seasonal.setPreference("auto");
    expect(seasonal.preference).toBe("auto");
  });
});

