import { describe, expect, it } from "vitest";
import { followThrough, pipelineHealth } from "./agent-scores";
import type { ApplicationStage, JobApplication, Task } from "./types";

const NOW = new Date("2026-09-08T12:00:00");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString();

function app(over: Partial<JobApplication> = {}): JobApplication {
  return {
    id: Math.random().toString(36).slice(2),
    company: "Acme",
    role: "Engineer",
    stage: "applied" as ApplicationStage,
    lifecycleStatus: "active",
    cvVariantId: null,
    appliedAt: daysAgo(1),
    stageEnteredAt: daysAgo(1),
    lastNudgedAt: null,
    nudgesIgnored: 0,
    notes: "",
    ...over,
  };
}

function task(over: Partial<Task> = {}): Task {
  return {
    id: Math.random().toString(36).slice(2),
    title: "Something",
    kind: "one_off",
    dueAt: null,
    completedAt: null,
    lastCompletedOn: null,
    createdAt: daysAgo(1),
    ...over,
  };
}

describe("an empty app is not a failing grade", () => {
  it("scores null rather than zero", () => {
    expect(pipelineHealth([]).score).toBeNull();
    expect(followThrough([], NOW).score).toBeNull();
  });
});

describe("pipeline health", () => {
  it("is full when everything live is still moving", () => {
    const result = pipelineHealth([app(), app()]);
    expect(result.score).toBe(100);
    expect(result.detail).toContain("2 live");
  });

  // Ghosting is the thing Tony exists to catch, so it has to move the number.
  it("drops when applications go overdue", () => {
    const result = pipelineHealth([app(), app({ stageEnteredAt: daysAgo(60) })]);
    expect(result.score).toBeLessThan(100);
    expect(result.detail).toMatch(/waiting on a reply/);
  });

  it("does not count rejections against you", () => {
    const withRejection = pipelineHealth([app(), app({ stage: "rejected" })]);
    expect(withRejection.score).toBe(100);
  });
});

describe("follow-through", () => {
  it("is the share of tasks actually finished", () => {
    const result = followThrough(
      [task({ completedAt: daysAgo(0) }), task(), task(), task()],
      NOW,
    );
    expect(result.score).toBe(25);
    expect(result.detail).toBe("1 done, 3 open");
  });

  it("calls out overdue work when there is any", () => {
    const result = followThrough([task({ dueAt: daysAgo(3) })], NOW);
    expect(result.detail).toContain("1 overdue");
  });

  // A daily task ticked today counts, even though it is never "completed".
  it("respects repeating-task completion", () => {
    const result = followThrough(
      [task({ kind: "daily", lastCompletedOn: "2026-09-08" })],
      NOW,
    );
    expect(result.score).toBe(100);
  });
});
