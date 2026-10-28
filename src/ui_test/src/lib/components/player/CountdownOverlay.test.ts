// T6.3 — auto-next countdown overlay: counts down, confirm on zero, cancel.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/svelte";
import CountdownOverlay from "./CountdownOverlay.svelte";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("CountdownOverlay", () => {
  test("renders label and initial seconds", async () => {
    render(CountdownOverlay, {
      props: { label: "Up next: Episode 2", seconds: 10, onconfirm: () => {}, oncancel: () => {} }
    });
    expect(screen.getByRole("alertdialog", { name: "Up next: Episode 2" })).toBeTruthy();
    expect(screen.getByText("10")).toBeTruthy();
  });

  test("counts down each second and auto-confirms at zero", async () => {
    const onconfirm = vi.fn();
    render(CountdownOverlay, {
      props: { label: "Up next", seconds: 3, onconfirm, oncancel: () => {} }
    });
    await vi.advanceTimersByTimeAsync(1000);
    expect(screen.getByText("2")).toBeTruthy();
    await vi.advanceTimersByTimeAsync(2000);
    expect(onconfirm).toHaveBeenCalledTimes(1);
  });

  test("Play now confirms immediately; Cancel fires oncancel", async () => {
    const onconfirm = vi.fn();
    const oncancel = vi.fn();
    render(CountdownOverlay, { props: { label: "Up next", seconds: 10, onconfirm, oncancel } });
    screen.getByRole("button", { name: "Play now" }).click();
    expect(onconfirm).toHaveBeenCalledTimes(1);
    screen.getByRole("button", { name: "Cancel" }).click();
    expect(oncancel).toHaveBeenCalledTimes(1);
  });
});
