import { describe, expect, it } from "vitest";
import {
  dueReminders,
  MAX_SCHEDULED,
  notificationIdFor,
  REMINDER_ID_FLOOR,
} from "./reminders";
import type { Task, TaskKind } from "./types";

const NOW = new Date("2026-09-04T12:00:00");

function task(over: Partial<Task> & { id: string }): Task {
  return {
    title: "Something",
    kind: "one_off" as TaskKind,
    dueAt: null,
    completedAt: null,
    lastCompletedOn: null,
    createdAt: NOW.toISOString(),
    ...over,
  };
}

const at = (iso: string) => new Date(iso).toISOString();

describe("notification ids", () => {
  it("stays clear of the digest and inside Android's int range", () => {
    for (const id of ["a", "kQ7x2", "task-with-a-much-longer-id", "", "🙂"]) {
      const n = notificationIdFor(id);
      expect(n).toBeGreaterThanOrEqual(REMINDER_ID_FLOOR);
      expect(n).toBeLessThan(0x7fffffff);
      expect(Number.isInteger(n)).toBe(true);
    }
  });

  // The same task has to map to the same notification every time, or a
  // reschedule would leave the previous one behind to fire twice.
  it("is stable for the same task and different across tasks", () => {
    expect(notificationIdFor("abc")).toBe(notificationIdFor("abc"));
    expect(notificationIdFor("abc")).not.toBe(notificationIdFor("abd"));
  });

  it("does not collide across a realistic number of tasks", () => {
    const ids = new Set(
      Array.from({ length: 5000 }, (_, i) => notificationIdFor(`task-${i}`)),
    );
    expect(ids.size).toBe(5000);
  });
});

describe("what gets scheduled", () => {
  it("takes dated, unfinished, future tasks", () => {
    const tasks = [
      task({ id: "future", dueAt: at("2026-09-04T17:00:00") }),
      task({ id: "undated" }),
      task({ id: "past", dueAt: at("2026-09-04T09:00:00") }),
      task({ id: "done", dueAt: at("2026-09-04T18:00:00"), completedAt: at("2026-09-04T10:00:00") }),
    ];
    expect(dueReminders(tasks, NOW).map((t) => t.id)).toEqual(["future"]);
  });

  it("puts the soonest first", () => {
    const tasks = [
      task({ id: "later", dueAt: at("2026-09-06T09:00:00") }),
      task({ id: "soon", dueAt: at("2026-09-04T13:00:00") }),
      task({ id: "middle", dueAt: at("2026-09-05T09:00:00") }),
    ];
    expect(dueReminders(tasks, NOW).map((t) => t.id)).toEqual(["soon", "middle", "later"]);
  });

  // Android holds every pending alarm in system_server; an unbounded list
  // is a way to get the app killed.
  it("never schedules more than the cap, keeping the nearest", () => {
    const tasks = Array.from({ length: 200 }, (_, i) =>
      task({ id: `t${i}`, dueAt: at(`2026-09-${String(5 + (i % 20)).padStart(2, "0")}T09:00:00`) }),
    );
    const got = dueReminders(tasks, NOW);
    expect(got).toHaveLength(MAX_SCHEDULED);
    const times = got.map((t) => new Date(t.dueAt as string).getTime());
    expect(Math.max(...times)).toBeLessThanOrEqual(
      Math.min(...tasks.map((t) => new Date(t.dueAt as string).getTime())) + 20 * 864e5,
    );
  });

  it("ignores an unparseable date rather than scheduling at NaN", () => {
    expect(dueReminders([task({ id: "bad", dueAt: "not a date" })], NOW)).toEqual([]);
  });

  // A daily task is not "done", it is done today - so tomorrow's instance
  // still deserves its reminder.
  it("respects repeating-task completion rules", () => {
    const doneToday = task({
      id: "daily",
      kind: "daily",
      dueAt: at("2026-09-04T20:00:00"),
      lastCompletedOn: "2026-09-04",
    });
    expect(dueReminders([doneToday], NOW)).toEqual([]);

    const doneYesterday = task({
      id: "daily2",
      kind: "daily",
      dueAt: at("2026-09-04T20:00:00"),
      lastCompletedOn: "2026-09-03",
    });
    expect(dueReminders([doneYesterday], NOW).map((t) => t.id)).toEqual(["daily2"]);
  });
});
