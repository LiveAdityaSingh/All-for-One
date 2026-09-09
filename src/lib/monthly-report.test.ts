import { describe, expect, it } from "vitest";
import { buildMonthlyReport, REPORT_DAYS } from "./monthly-report";
import type { Capture, CaptureKind } from "./types";

const NOW = new Date("2026-09-09T20:00:00");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString();

function cap(kind: CaptureKind, over: Partial<Capture> = {}): Capture {
  return {
    id: Math.random().toString(36).slice(2),
    kind,
    agent: "marco",
    raw: "",
    label: kind,
    capturedAt: daysAgo(1),
    ...over,
  };
}

describe("an empty month says so once", () => {
  it("reports emptiness rather than a wall of zeroes", () => {
    const report = buildMonthlyReport([], NOW);
    expect(report.empty).toBe(true);
    expect(report.sleep.averageHours).toBeNull();
    expect(report.movement.topActivity).toBeNull();
    expect(report.movement.busiest).toBeNull();
  });
});

describe("what the month counts", () => {
  const captures = [
    cap("workout", { label: "Legs", durationMinutes: 45, capturedAt: daysAgo(1) }),
    cap("workout", { label: "Legs", durationMinutes: 30, capturedAt: daysAgo(3) }),
    cap("workout", { label: "Swim", durationMinutes: 60, capturedAt: daysAgo(10) }),
    cap("sleep", { durationMinutes: 480, capturedAt: daysAgo(1) }),
    cap("sleep", { durationMinutes: 360, capturedAt: daysAgo(2) }),
    cap("meal", { capturedAt: daysAgo(1) }),
    cap("meal", { capturedAt: daysAgo(1) }), // same day, one day logged
    cap("meal", { capturedAt: daysAgo(5) }),
  ];

  it("totals movement and names what you did most", () => {
    const { movement } = buildMonthlyReport(captures, NOW);
    expect(movement.sessions).toBe(3);
    expect(movement.minutes).toBe(135);
    expect(movement.topActivity).toBe("Legs");
  });

  it("averages sleep over nights recorded, with the range", () => {
    const { sleep } = buildMonthlyReport(captures, NOW);
    expect(sleep.nights).toBe(2);
    expect(sleep.averageHours).toBe(7);
    expect(sleep.shortest).toBe(6);
    expect(sleep.longest).toBe(8);
  });

  // Two meals on one day is one day of eating logged, not two.
  it("counts days of fuel rather than meals", () => {
    const { fuel } = buildMonthlyReport(captures, NOW);
    expect(fuel.meals).toBe(3);
    expect(fuel.daysLogged).toBe(2);
  });

  it("ignores anything older than the window", () => {
    const old = [cap("workout", { durationMinutes: 90, capturedAt: daysAgo(REPORT_DAYS + 5) })];
    expect(buildMonthlyReport(old, NOW).movement.sessions).toBe(0);
  });

  it("counts an untimed session at the same conservative 30 minutes", () => {
    const report = buildMonthlyReport([cap("workout", { durationMinutes: null })], NOW);
    expect(report.movement.minutes).toBe(30);
  });
});

describe("the weekly breakdown", () => {
  it("splits the window into four equal weeks, newest first", () => {
    const { weeks } = buildMonthlyReport([], NOW);
    expect(weeks).toHaveLength(4);
    expect(weeks[0].label).toBe("This week");
    expect(weeks[1].label).toBe("Last week");
  });

  it("puts each session in the week it happened", () => {
    const { weeks } = buildMonthlyReport(
      [
        cap("workout", { durationMinutes: 30, capturedAt: daysAgo(2) }),
        cap("workout", { durationMinutes: 30, capturedAt: daysAgo(9) }),
        cap("workout", { durationMinutes: 30, capturedAt: daysAgo(20) }),
      ],
      NOW,
    );
    expect(weeks[0].sessions).toBe(1);
    expect(weeks[1].sessions).toBe(1);
    expect(weeks[2].sessions).toBe(1);
    expect(weeks[3].sessions).toBe(0);
  });

  it("names the busiest week", () => {
    const report = buildMonthlyReport(
      [
        cap("workout", { capturedAt: daysAgo(9) }),
        cap("workout", { capturedAt: daysAgo(10) }),
        cap("workout", { capturedAt: daysAgo(2) }),
      ],
      NOW,
    );
    expect(report.movement.busiest?.label).toBe("Last week");
  });
});
