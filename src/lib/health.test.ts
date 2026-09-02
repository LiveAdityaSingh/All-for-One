import { describe, expect, it } from "vitest";
import { buildWeeklyReport, describeTrend } from "./health";
import type { Capture } from "./types";

const NOW = new Date("2026-06-30T12:00:00");
const DAY = 24 * 60 * 60 * 1000;

function workout(daysAgo: number, label: string, minutes: number | null): Capture {
  return {
    id: `w${daysAgo}${label}`,
    kind: "workout",
    agent: "marco",
    raw: "",
    label,
    durationMinutes: minutes,
    capturedAt: new Date(NOW.getTime() - daysAgo * DAY).toISOString(),
  };
}

describe("weekly health report", () => {
  it("counts only the last seven days", () => {
    const report = buildWeeklyReport(
      [workout(1, "Legs", 45), workout(3, "Cardio", 30), workout(10, "Legs", 60)],
      NOW,
    );
    expect(report.sessions).toBe(2);
    expect(report.totalMinutes).toBe(75);
  });

  it("compares against the preceding week", () => {
    const report = buildWeeklyReport(
      [workout(1, "Legs", 45), workout(9, "Legs", 45), workout(10, "Cardio", 20)],
      NOW,
    );
    expect(report.previousSessions).toBe(2);
    expect(describeTrend(report)).toContain("1 fewer session");
  });

  it("ignores captures that are not workouts", () => {
    const expense = { ...workout(1, "Lunch", null), kind: "expense" as const, agent: "vanessa" as const };
    expect(buildWeeklyReport([expense], NOW).sessions).toBe(0);
  });

  it("says nothing comparative without prior history", () => {
    const report = buildWeeklyReport([workout(1, "Legs", 45)], NOW);
    expect(describeTrend(report)).toContain("nothing to compare");
  });

  it("stays descriptive rather than prescriptive", () => {
    // Marco must never tell the user what to do (build spec §9).
    const report = buildWeeklyReport([workout(1, "Legs", 45), workout(9, "Legs", 45)], NOW);
    const text = describeTrend(report).toLowerCase();
    for (const word of ["should", "try to", "aim", "need to", "recommend"]) {
      expect(text).not.toContain(word);
    }
  });
});
