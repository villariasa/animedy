// T6.3 — player controls render + skip-button visibility windows.
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import Player from "./Player.svelte";
import type { SkipSegment } from "$lib/api/types";

afterEach(cleanup);

const SEGMENTS: SkipSegment[] = [
  { skip_type: "intro", start_seconds: 10, end_seconds: 95, source: "aniskip" },
  { skip_type: "outro", start_seconds: 1300, end_seconds: 1400, source: "aniskip" }
];

function renderPlayer(extra: Record<string, unknown> = {}) {
  return render(Player, {
    props: {
      streamUrl: "https://example.test/ep1.mp4",
      skipSegments: SEGMENTS,
      title: "Attack on Titan",
      episodeLabel: "Episode 1",
      canPrev: false,
      canNext: true,
      ...extra
    }
  });
}

function getVideo(container: HTMLElement): HTMLVideoElement {
  const video = container.querySelector("video");
  if (!video) {
    throw new Error("video element not rendered");
  }
  return video;
}

async function seekTo(video: HTMLVideoElement, seconds: number): Promise<void> {
  Object.defineProperty(video, "currentTime", { value: seconds, writable: true, configurable: true });
  video.dispatchEvent(new Event("timeupdate"));
  await tick();
}

describe("Player controls", () => {
  test("renders core controls (play, seek, volume, speed, fullscreen, PiP, drawer)", () => {
    renderPlayer();
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    expect(screen.getByRole("slider", { name: "Seek" })).toBeTruthy();
    expect(screen.getByRole("slider", { name: "Volume" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Playback speed" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Fullscreen" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Picture in picture" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Episode list" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Rewind 10 seconds" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Fast forward 10 seconds" })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: /Auto Play/ })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: /Auto Next/ })).toBeTruthy();
  });

  test("prev disabled / next enabled per props; next fires onnext", () => {
    const onnext = vi.fn();
    renderPlayer({ onnext });
    const prev = screen.getByRole("button", { name: "Previous episode" }) as HTMLButtonElement;
    const next = screen.getByRole("button", { name: "Next episode" }) as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(false);
    next.click();
    expect(onnext).toHaveBeenCalledTimes(1);
  });

  test("rewind and fast-forward buttons seek by 10s", async () => {
    const { container } = renderPlayer();
    const video = getVideo(container);
    Object.defineProperty(video, "duration", { value: 500, writable: true, configurable: true });
    await seekTo(video, 100);

    const fwdBtn = screen.getByRole("button", { name: "Fast forward 10 seconds" });
    const rewBtn = screen.getByRole("button", { name: "Rewind 10 seconds" });

    fwdBtn.click();
    await tick();
    expect(video.currentTime).toBe(110);

    rewBtn.click();
    await tick();
    expect(video.currentTime).toBe(100);
  });

  test("double-tap right zone fast forwards 10s and accumulates on consecutive taps", async () => {
    const { container } = renderPlayer();
    const video = getVideo(container);
    Object.defineProperty(video, "duration", { value: 500, writable: true, configurable: true });
    await seekTo(video, 50);

    // Right zone is the presentation div with inset-y-0 right-0
    const rightZone = container.querySelector(".absolute.inset-y-0.right-0") as HTMLElement;
    expect(rightZone).toBeTruthy();

    // First tap
    rightZone.click();
    await tick();
    expect(video.currentTime).toBe(50); // Single tap does not seek immediately

    // Second tap (double tap)
    rightZone.click();
    await tick();
    expect(video.currentTime).toBe(60); // Fast forwards +10s
    expect(screen.getByText("+10 seconds")).toBeTruthy();

    // Third tap (accumulation)
    rightZone.click();
    await tick();
    expect(video.currentTime).toBe(70); // Fast forwards another +10s (+20s total)
    expect(screen.getByText("+20 seconds")).toBeTruthy();
  });

  test("double-tap left zone rewinds 10s", async () => {
    const { container } = renderPlayer();
    const video = getVideo(container);
    Object.defineProperty(video, "duration", { value: 500, writable: true, configurable: true });
    await seekTo(video, 50);

    // Left zone is the presentation div with inset-y-0 left-0
    const leftZone = container.querySelector(".absolute.inset-y-0.left-0") as HTMLElement;
    expect(leftZone).toBeTruthy();

    // First tap
    leftZone.click();
    await tick();
    expect(video.currentTime).toBe(50);

    // Second tap (double tap)
    leftZone.click();
    await tick();
    expect(video.currentTime).toBe(40); // Rewinds -10s
    expect(screen.getByText("-10 seconds")).toBeTruthy();
  });

  test("keyboard shortcuts (j / l / ArrowLeft / ArrowRight) seek properly", async () => {
    const { container } = renderPlayer();
    const video = getVideo(container);
    Object.defineProperty(video, "duration", { value: 500, writable: true, configurable: true });
    await seekTo(video, 50);

    // 'l' or ArrowRight seeks forward
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "l" }));
    await tick();
    expect(video.currentTime).toBe(60);

    // 'j' or ArrowLeft seeks backward
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "j" }));
    await tick();
    expect(video.currentTime).toBe(50);
  });
});

describe("skip-button visibility windows", () => {
  test("no skip button outside any window", async () => {
    const { container } = renderPlayer();
    await seekTo(getVideo(container), 5);
    expect(screen.queryByRole("button", { name: /Skip/ })).toBeNull();
  });

  test("Skip Intro appears inside the intro window and seeks to its end", async () => {
    const { container } = renderPlayer();
    const video = getVideo(container);
    await seekTo(video, 20);
    const btn = screen.getByRole("button", { name: "Skip Intro" });
    btn.click();
    await tick();
    expect(video.currentTime).toBe(95);
  });

  test("Skip Outro appears inside the outro window", async () => {
    const { container } = renderPlayer();
    await seekTo(getVideo(container), 1350);
    expect(screen.getByRole("button", { name: "Skip Outro" })).toBeTruthy();
  });

  test("button disappears after the window ends", async () => {
    const { container } = renderPlayer();
    const video = getVideo(container);
    await seekTo(video, 20);
    expect(screen.getByRole("button", { name: "Skip Intro" })).toBeTruthy();
    await seekTo(video, 96);
    expect(screen.queryByRole("button", { name: "Skip Intro" })).toBeNull();
  });
});
