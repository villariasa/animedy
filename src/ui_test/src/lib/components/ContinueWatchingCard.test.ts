// T6.3 — Continue Watching card: title/season/episode, % math, remaining time.
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/svelte";
import ContinueWatchingCard from "./ContinueWatchingCard.svelte";
import type { ContinueWatchingItem } from "$lib/api/types";

afterEach(cleanup);

const ITEM: ContinueWatchingItem = {
  franchise_key: "1",
  anime_id: 10,
  title_romaji: "Shingeki no Kyojin",
  title_english: "Attack on Titan",
  season_label: "Season 2",
  episode_id: 100,
  episode_number: 5,
  progress_percent: 42.4,
  remaining_seconds: 840,
  last_watched_at: "2026-10-28 12:00:00"
};

describe("ContinueWatchingCard", () => {
  test("shows preferred title, season label and episode number", () => {
    render(ContinueWatchingCard, { props: { item: ITEM } });
    expect(screen.getByText("Attack on Titan")).toBeTruthy();
    // Svelte splits the line into several text nodes — match on element text.
    expect(
      screen.getByText((_, el) => el?.tagName === "P" && /Season 2 ·\s*Episode 5/.test(el.textContent ?? ""))
    ).toBeTruthy();
  });

  test("progress bar math: rounded % + remaining time", () => {
    render(ContinueWatchingCard, { props: { item: ITEM } });
    const bar = screen.getByRole("progressbar", { name: "Watch progress" });
    expect(bar.getAttribute("aria-valuenow")).toBe("42");
    expect(screen.getByText(/42% · 14 min left/)).toBeTruthy();
  });

  test("clamps progress above 100", () => {
    render(ContinueWatchingCard, { props: { item: { ...ITEM, progress_percent: 140 } } });
    const bar = screen.getByRole("progressbar", { name: "Watch progress" });
    expect(bar.getAttribute("aria-valuenow")).toBe("100");
  });

  test("has a Continue button", () => {
    render(ContinueWatchingCard, { props: { item: ITEM } });
    expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy();
  });
});
