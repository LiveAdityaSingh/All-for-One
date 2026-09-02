import { describe, expect, it } from "vitest";
import { isDoneForNow, isOverdue, toDayKey } from "./tasks";
import type { Task } from "./types";

function task(partial: Partial<Task>): Task {
  return {
    id: "t1",
    title: "Test",
    kind: "one_off",
    dueAt: null,
    completedAt: null,
    lastCompletedOn: null,
    createdAt: "2026-03-01T00:00:00.000Z",
    ...partial,
  };
}

describe("repeating task completion", () => {
  const now = new Date("2026-03-10T09:00:00");

  it("treats a daily task ticked today as done", () => {
    expect(isDoneForNow(task({ kind: "daily", lastCompletedOn: "2026-03-10" }), now)).toBe(true);
  });

  it("reopens a daily task the next day without any reset job", () => {
    expect(isDoneForNow(task({ kind: "daily", lastCompletedOn: "2026-03-09" }), now)).toBe(false);
  });

  it("treats a monthly task ticked earlier this month as done", () => {
    expect(isDoneForNow(task({ kind: "monthly", lastCompletedOn: "2026-03-02" }), now)).toBe(true);
  });

  it("reopens a monthly task in a new month", () => {
    expect(isDoneForNow(task({ kind: "monthly", lastCompletedOn: "2026-02-28" }), now)).toBe(false);
  });

  it("uses the completion flag for one-off tasks and milestones", () => {
    expect(isDoneForNow(task({ completedAt: "2026-03-01T00:00:00.000Z" }), now)).toBe(true);
    expect(isDoneForNow(task({ kind: "milestone" }), now)).toBe(false);
  });
});

describe("overdue", () => {
  const now = new Date("2026-03-10T09:00:00");

  it("flags a past due date that is still open", () => {
    expect(isOverdue(task({ dueAt: "2026-03-09T09:00:00" }), now)).toBe(true);
  });

  it("does not flag a completed task", () => {
    expect(
      isOverdue(task({ dueAt: "2026-03-09T09:00:00", completedAt: "2026-03-09T10:00:00" }), now),
    ).toBe(false);
  });

  it("does not flag an undated task", () => {
    expect(isOverdue(task({ kind: "daily" }), now)).toBe(false);
  });
});

describe("toDayKey", () => {
  it("formats in local time, not UTC", () => {
    // A late-evening local time must not roll into the next day.
    expect(toDayKey(new Date("2026-03-10T23:30:00"))).toBe("2026-03-10");
  });

  it("zero-pads month and day", () => {
    expect(toDayKey(new Date("2026-01-05T12:00:00"))).toBe("2026-01-05");
  });
});
