import { describe, expect, it } from "vitest";
import { buildSplashLine, FALLBACK_LINES } from "./splash-line";

const nothing = { streak: null, openLoops: 0, sessionsThisWeek: 0 };

describe("what the opening line says", () => {
  it("leads with a run you could break today", () => {
    const line = buildSplashLine({
      streak: { days: 3, title: "Stretch" },
      openLoops: 4,
      sessionsThisWeek: 2,
    });
    expect(line).toEqual({ text: "3-day run on Stretch", personal: true });
  });

  // "1-day run" is not a run, it is a Tuesday.
  it("ignores a run of one", () => {
    const line = buildSplashLine({ ...nothing, streak: { days: 1, title: "Stretch" }, openLoops: 2 });
    expect(line.text).toBe("2 things waiting on you");
  });

  it("falls back through open loops, then last week's sessions", () => {
    expect(buildSplashLine({ ...nothing, openLoops: 1 }).text).toBe("1 thing waiting on you");
    expect(buildSplashLine({ ...nothing, sessionsThisWeek: 3 }).text).toBe(
      "3 sessions logged this week",
    );
  });

  it("uses a borrowed line only when nothing true can be said", () => {
    const line = buildSplashLine(nothing);
    expect(line.personal).toBe(false);
    expect(FALLBACK_LINES).toContain(line.text);
  });

  // Rotating by day rather than at random: opening twice in a row should
  // not look like it is shuffling for effect.
  it("keeps the same borrowed line all day", () => {
    expect(buildSplashLine(nothing, 7).text).toBe(buildSplashLine(nothing, 7).text);
    expect(buildSplashLine(nothing, 7).text).not.toBe(buildSplashLine(nothing, 8).text);
  });

  it("handles a negative or fractional day without crashing", () => {
    expect(FALLBACK_LINES).toContain(buildSplashLine(nothing, -3).text);
    expect(FALLBACK_LINES).toContain(buildSplashLine(nothing, 2.7).text);
  });
});
