import { describe, expect, it } from "vitest";
import { daysToGraduate, graduationProgress, streakTier } from "./streaks";
import { currentStreak, previousApplicableDay, STREAK_TO_GRADUATE } from "./tasks";
import type { Task } from "./types";

// 2026-09-09 is a Wednesday.
const WEDNESDAY = new Date("2026-09-09T12:00:00");

function habit(over: Partial<Task> = {}): Task {
  return {
    id: "h", title: "Stretch", kind: "habit", weekdays: null, timesPerDay: 1,
    completedToday: 0, streak: 0, streakDay: null, dueAt: null,
    completedAt: null, lastCompletedOn: null, createdAt: "2026-09-01T09:00:00.000Z",
    ...over,
  };
}

describe("the marker escalates with the run", () => {
  it("shows nothing at all below a day", () => {
    expect(streakTier(0)).toBeNull();
    expect(streakTier(-1)).toBeNull();
  });

  it("moves through spark, fire and beyond", () => {
    expect(streakTier(1)?.icon).toBe("sparkle");
    expect(streakTier(3)?.icon).toBe("flame");
    expect(streakTier(7)?.icon).toBe("zap");
    expect(streakTier(14)?.icon).toBe("star");
    expect(streakTier(21)?.icon).toBe("rocket");
    expect(streakTier(40)?.icon).toBe("rocket");
  });

  it("counts down to graduation", () => {
    expect(daysToGraduate(0)).toBe(STREAK_TO_GRADUATE);
    expect(daysToGraduate(20)).toBe(1);
    expect(daysToGraduate(21)).toBe(0);
    expect(graduationProgress(0)).toBe(0);
    expect(graduationProgress(21)).toBe(1);
    expect(graduationProgress(30)).toBe(1);
  });
});

describe("whether a run is still alive", () => {
  it("counts a run extended today", () => {
    expect(currentStreak(habit({ streak: 4, streakDay: "2026-09-09" }), WEDNESDAY)).toBe(4);
  });

  // Today is not done yet, but yesterday was - the run is alive, waiting.
  it("counts a run extended on the previous applicable day", () => {
    expect(currentStreak(habit({ streak: 4, streakDay: "2026-09-08" }), WEDNESDAY)).toBe(4);
  });

  it("breaks when an applicable day was missed", () => {
    expect(currentStreak(habit({ streak: 9, streakDay: "2026-09-06" }), WEDNESDAY)).toBe(0);
  });

  // A habit set to Mondays is not broken by being skipped on a Tuesday.
  it("skips the days a habit does not apply to", () => {
    const mondays = habit({ weekdays: [1], streak: 5, streakDay: "2026-09-07" });
    expect(previousApplicableDay(mondays, WEDNESDAY)?.getDay()).toBe(1);
    expect(currentStreak(mondays, WEDNESDAY)).toBe(5);
  });

  it("is zero for anything that is not a habit", () => {
    expect(currentStreak(habit({ kind: "daily", streak: 9, streakDay: "2026-09-09" }), WEDNESDAY)).toBe(0);
  });
});
