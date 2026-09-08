import { describe, expect, it } from "vitest";
import { appliesOn, doneToday, isDoneForNow, isOverdue, timesPerDay } from "./tasks";
import type { Task } from "./types";

// 2026-09-09 is a Wednesday (getDay() === 3).
const WEDNESDAY = new Date("2026-09-09T12:00:00");
const THURSDAY = new Date("2026-09-10T12:00:00");

function habit(over: Partial<Task> = {}): Task {
  return {
    id: "h1",
    title: "Stretch",
    kind: "habit",
    weekdays: null,
    timesPerDay: 1,
    completedToday: 0,
    dueAt: null,
    completedAt: null,
    lastCompletedOn: null,
    createdAt: "2026-09-01T09:00:00.000Z",
    ...over,
  };
}

describe("which days a habit applies to", () => {
  it("applies every day when no days were chosen", () => {
    expect(appliesOn(habit({ weekdays: null }), WEDNESDAY)).toBe(true);
    expect(appliesOn(habit({ weekdays: [] }), WEDNESDAY)).toBe(true);
  });

  it("applies only on the days chosen", () => {
    const tueThu = habit({ weekdays: [2, 4] });
    expect(appliesOn(tueThu, WEDNESDAY)).toBe(false);
    expect(appliesOn(tueThu, THURSDAY)).toBe(true);
  });

  // A habit that does not apply today owes you nothing, so it must not sit
  // in the open list nagging, and must never read as overdue.
  it("owes nothing on a day it does not apply to", () => {
    const tueThu = habit({ weekdays: [2, 4], dueAt: "2026-09-08T09:00:00.000Z" });
    expect(isDoneForNow(tueThu, WEDNESDAY)).toBe(true);
    expect(isOverdue(tueThu, WEDNESDAY)).toBe(false);
  });

  it("still applies to everything that is not a habit", () => {
    expect(appliesOn({ ...habit(), kind: "daily", weekdays: [2] }, WEDNESDAY)).toBe(true);
  });
});

describe("counting a habit done several times a day", () => {
  it("is not finished until every repetition is done", () => {
    const thrice = habit({
      timesPerDay: 3,
      completedToday: 2,
      lastCompletedOn: "2026-09-09",
    });
    expect(doneToday(thrice, WEDNESDAY)).toBe(2);
    expect(isDoneForNow(thrice, WEDNESDAY)).toBe(false);

    const finished = { ...thrice, completedToday: 3 };
    expect(isDoneForNow(finished, WEDNESDAY)).toBe(true);
  });

  // The count belongs to the day it was written on, so a new day resets it
  // without anything having to run overnight.
  it("yesterday's count reads as zero today", () => {
    const yesterday = habit({
      timesPerDay: 3,
      completedToday: 3,
      lastCompletedOn: "2026-09-08",
    });
    expect(doneToday(yesterday, WEDNESDAY)).toBe(0);
    expect(isDoneForNow(yesterday, WEDNESDAY)).toBe(false);
  });

  it("treats a missing or nonsense repetition count as once", () => {
    expect(timesPerDay(habit({ timesPerDay: null }))).toBe(1);
    expect(timesPerDay(habit({ timesPerDay: 0 }))).toBe(1);
    expect(timesPerDay(habit({ timesPerDay: 2.4 }))).toBe(2);
  });
});
