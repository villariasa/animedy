// T6.3 — Continue Watching card math + shared formatters.
import { describe, expect, test } from "vitest";
import { displayTitle, formatRemaining, formatTime, stripHtml } from "./format";

describe("formatRemaining (Continue Watching card)", () => {
  test("hours + minutes", () => {
    expect(formatRemaining(5400)).toBe("1 h 30 min left");
  });
  test("minutes only", () => {
    expect(formatRemaining(1440)).toBe("24 min left");
  });
  test("seconds only", () => {
    expect(formatRemaining(45)).toBe("45 s left");
  });
  test("clamps negatives to zero", () => {
    expect(formatRemaining(-10)).toBe("0 s left");
  });
});

describe("formatTime (player clock)", () => {
  test("h:mm:ss over an hour", () => {
    expect(formatTime(3723)).toBe("1:02:03");
  });
  test("m:ss under an hour", () => {
    expect(formatTime(83)).toBe("1:23");
  });
});

describe("displayTitle", () => {
  test("prefers english, falls back to romaji, then placeholder", () => {
    expect(displayTitle("Attack on Titan", "Shingeki no Kyojin")).toBe("Attack on Titan");
    expect(displayTitle(null, "Shingeki no Kyojin")).toBe("Shingeki no Kyojin");
    expect(displayTitle(null, null)).toBe("Untitled");
  });
});

describe("stripHtml (XSS-safe descriptions)", () => {
  test("keeps <br> as newline, drops other tags, decodes entities", () => {
    expect(stripHtml("Line1<br>Line2 <i>italic</i> &amp; <script>alert(1)</script>")).toBe(
      "Line1\nLine2 italic & alert(1)"
    );
  });
});
