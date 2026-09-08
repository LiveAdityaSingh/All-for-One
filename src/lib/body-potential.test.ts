import { describe, expect, it } from "vitest";
import { bmiFrom, computeBodyPotential } from "./body-potential";
import type { BodyMetrics, Capture, CaptureKind } from "./types";

const NOW = new Date("2026-09-08T20:00:00");
const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

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

const metrics: BodyMetrics = {
  id: "me",
  heightCm: 180,
  weightKg: 81,
  birthYear: 1996,
  sex: "unspecified",
  updatedAt: NOW.toISOString(),
};

describe("no data is not zero", () => {
  it("returns null rather than a damning 0%", () => {
    const result = computeBodyPotential([], undefined, NOW);
    expect(result.score).toBeNull();
    expect(result.counted).toBe(0);
    expect(result.headline).toMatch(/Log a workout/);
  });

  it("marks every component as unlogged rather than scoring it", () => {
    const result = computeBodyPotential([], undefined, NOW);
    expect(result.components.map((c) => c.score)).toEqual([null, null, null]);
    expect(result.components.every((c) => /nothing logged/.test(c.detail))).toBe(true);
  });
});

describe("scoring only what was actually logged", () => {
  it("averages the components that have data and says so", () => {
    // 150 active minutes = the full weekly guideline.
    const result = computeBodyPotential(
      [cap("workout", { durationMinutes: 150 })],
      metrics,
      NOW,
    );
    expect(result.components[0].score).toBe(100);
    expect(result.score).toBe(100);
    expect(result.counted).toBe(1);
    expect(result.headline).toBe("From movement only");
  });

  it("names all three once all three are present", () => {
    const result = computeBodyPotential(
      [
        cap("workout", { durationMinutes: 75 }),
        cap("sleep", { durationMinutes: 450 }),
        cap("meal"),
      ],
      metrics,
      NOW,
    );
    expect(result.counted).toBe(3);
    expect(result.headline).toBe("From movement, sleep and fuel");
    // 50 movement, 100 sleep (7.5h hits target), 14 fuel (1 of 7 days).
    expect(result.components.map((c) => c.score)).toEqual([50, 100, 14]);
    expect(result.score).toBe(55);
  });

  // A missed log should not read as a sleepless night.
  it("averages sleep over nights recorded, not over the window", () => {
    const result = computeBodyPotential(
      [cap("sleep", { durationMinutes: 450 }), cap("sleep", { durationMinutes: 450, capturedAt: daysAgo(2) })],
      metrics,
      NOW,
    );
    expect(result.components[1].score).toBe(100);
    expect(result.components[1].detail).toContain("2 nights");
  });

  it("ignores anything older than the window", () => {
    const result = computeBodyPotential(
      [cap("workout", { durationMinutes: 150, capturedAt: daysAgo(30) })],
      metrics,
      NOW,
    );
    expect(result.score).toBeNull();
  });

  it("counts an untimed session conservatively rather than not at all", () => {
    const result = computeBodyPotential([cap("workout", { durationMinutes: null })], metrics, NOW);
    expect(result.components[0].score).toBe(20); // 30 of 150 minutes
  });

  it("never exceeds 100 however much is logged", () => {
    const result = computeBodyPotential(
      [cap("workout", { durationMinutes: 2000 }), cap("sleep", { durationMinutes: 900 })],
      metrics,
      NOW,
    );
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

describe("BMI", () => {
  it("computes from height and weight", () => {
    expect(bmiFrom(metrics)).toBe(25);
  });

  it("is null until both are known", () => {
    expect(bmiFrom(undefined)).toBeNull();
    expect(bmiFrom({ ...metrics, weightKg: null })).toBeNull();
    expect(bmiFrom({ ...metrics, heightCm: 0 })).toBeNull();
  });
});
