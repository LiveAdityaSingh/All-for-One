import { describe, expect, it } from "vitest";
import {
  dueReminders,
  nextReminderAt,
  upcomingReminders,
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
    expect(dueReminders(tasks, NOW).map((r) => r.task.id)).toEqual(["future"]);
  });

  it("puts the soonest first", () => {
    const tasks = [
      task({ id: "later", dueAt: at("2026-09-06T09:00:00") }),
      task({ id: "soon", dueAt: at("2026-09-04T13:00:00") }),
      task({ id: "middle", dueAt: at("2026-09-05T09:00:00") }),
    ];
    expect(dueReminders(tasks, NOW).map((r) => r.task.id)).toEqual(["soon", "middle", "later"]);
  });

  // Android holds every pending alarm in system_server; an unbounded list
  // is a way to get the app killed.
  it("never schedules more than the cap, keeping the nearest", () => {
    const tasks = Array.from({ length: 200 }, (_, i) =>
      task({ id: `t${i}`, dueAt: at(`2026-09-${String(5 + (i % 20)).padStart(2, "0")}T09:00:00`) }),
    );
    const got = dueReminders(tasks, NOW);
    expect(got).toHaveLength(MAX_SCHEDULED);
    const times = got.map((r) => r.at.getTime());
    expect(Math.max(...times)).toBeLessThanOrEqual(
      Math.min(...tasks.map((t) => new Date(t.dueAt as string).getTime())) + 20 * 864e5,
    );
  });

  it("ignores an unparseable date rather than scheduling at NaN", () => {
    expect(dueReminders([task({ id: "bad", dueAt: "not a date" })], NOW)).toEqual([]);
  });

  // This previously asserted the bug: a daily task ticked today was
  // dropped from the schedule entirely, and because every later sync saw a
  // dueAt in the past it never came back. Ticking today should move the
  // reminder to tomorrow, not cancel the habit.
  it("rolls a ticked daily task on to tomorrow", () => {
    const doneToday = task({
      id: "daily",
      kind: "daily",
      dueAt: at("2026-09-04T20:00:00"),
      lastCompletedOn: "2026-09-04",
    });
    const [scheduled] = dueReminders([doneToday], NOW);
    expect(scheduled.task.id).toBe("daily");
    expect(scheduled.at.toISOString().slice(0, 10)).toBe("2026-09-05");
    expect(scheduled.at.getHours()).toBe(20);
  });

  it("keeps today's slot when the habit is still outstanding", () => {
    const notYet = task({ id: "daily2", kind: "daily", dueAt: at("2026-09-04T20:00:00") });
    const [scheduled] = dueReminders([notYet], NOW);
    expect(scheduled.at.toISOString().slice(0, 10)).toBe("2026-09-04");
  });
});

describe("when a repeating task next comes round", () => {
  it("moves a daily past its time to tomorrow", () => {
    const morning = task({ id: "d", kind: "daily", dueAt: at("2026-09-04T08:00:00") });
    const next = nextReminderAt(morning, NOW);
    expect(next?.toISOString().slice(0, 10)).toBe("2026-09-05");
    expect(next?.getHours()).toBe(8);
  });

  it("keeps a monthly on its day of the month", () => {
    const rent = task({ id: "m", kind: "monthly", dueAt: at("2026-09-20T09:00:00") });
    const next = nextReminderAt(rent, NOW);
    expect(next?.getDate()).toBe(20);
    expect(next?.getMonth()).toBe(8); // September
  });

  it("rolls a monthly whose day has passed into next month", () => {
    const rent = task({ id: "m", kind: "monthly", dueAt: at("2026-09-01T09:00:00") });
    expect(nextReminderAt(rent, NOW)?.getMonth()).toBe(9); // October
  });

  // A reminder set for the 31st must not skip a short month by rolling
  // into the next one.
  it("clamps a 31st onto a shorter month", () => {
    const monthEnd = task({ id: "m", kind: "monthly", dueAt: at("2026-08-31T09:00:00") });
    const next = nextReminderAt(monthEnd, new Date("2026-11-15T12:00:00"));
    expect(next?.getMonth()).toBe(10); // November
    expect(next?.getDate()).toBe(30); // which has only 30 days
  });

  it("never reschedules something with an end rather than a rhythm", () => {
    const finished = task({
      id: "o",
      kind: "one_off",
      dueAt: at("2026-09-04T08:00:00"),
      completedAt: at("2026-09-04T09:00:00"),
    });
    expect(nextReminderAt(finished, NOW)).toBeNull();
    const missed = task({ id: "o2", kind: "one_off", dueAt: at("2026-09-04T08:00:00") });
    expect(nextReminderAt(missed, NOW)).toBeNull();
  });
});

describe("a habit only rings on the days it applies to", () => {
  // 2026-09-09 is a Wednesday.
  const wednesday = new Date("2026-09-09T12:00:00");

  const habit = (over = {}) =>
    task({
      id: "h",
      kind: "habit",
      dueAt: at("2026-09-09T08:00:00"),
      weekdays: null,
      timesPerDay: 1,
      completedToday: 0,
      ...over,
    });

  it("moves past today once its time has gone", () => {
    const next = nextReminderAt(habit(), wednesday);
    expect(next?.toISOString().slice(0, 10)).toBe("2026-09-10");
  });

  // Tuesdays and Thursdays: from Wednesday the next one is Thursday.
  it("skips forward to the next chosen weekday", () => {
    const next = nextReminderAt(habit({ weekdays: [2, 4] }), wednesday);
    expect(next?.getDay()).toBe(4);
    expect(next?.toISOString().slice(0, 10)).toBe("2026-09-10");
  });

  it("wraps around the week when the next day is far off", () => {
    // Mondays only: from Wednesday that is five days away.
    const next = nextReminderAt(habit({ weekdays: [1] }), wednesday);
    expect(next?.getDay()).toBe(1);
    expect(next?.toISOString().slice(0, 10)).toBe("2026-09-14");
  });

  it("keeps today's slot when the time has not passed yet", () => {
    const evening = habit({ dueAt: at("2026-09-09T20:00:00") });
    expect(nextReminderAt(evening, wednesday)?.toISOString().slice(0, 10)).toBe("2026-09-09");
  });
});

describe("a habit rings once per repetition", () => {
  // 2026-09-09 is a Wednesday; 08:00 with a 12-hour waking window.
  const morning = new Date("2026-09-09T07:00:00");

  const twiceDaily = (over = {}) =>
    task({
      id: "h",
      kind: "habit",
      dueAt: at("2026-09-09T08:00:00"),
      weekdays: null,
      timesPerDay: 2,
      completedToday: 0,
      ...over,
    });

  it("spreads the repetitions across the day rather than firing together", () => {
    const times = upcomingReminders(twiceDaily(), morning);
    const today = times.filter((t) => t.toISOString().slice(0, 10) === "2026-09-09");
    expect(today).toHaveLength(2);
    expect(today[0].getHours()).toBe(8);
    expect(today[1].getHours()).toBe(14); // twelve waking hours split in two
  });

  it("gives each repetition its own notification", () => {
    const scheduled = dueReminders([twiceDaily()], morning);
    const ids = scheduled.map((r) => notificationIdFor(r.occurrence === 0 ? r.task.id : `${r.task.id}#${r.occurrence}`));
    expect(new Set(ids).size).toBe(ids.length);
  });

  // Doing one of them should silence that one, not all of them.
  it("stops reminding for repetitions already done today", () => {
    const half = twiceDaily({ completedToday: 1, lastCompletedOn: "2026-09-09" });
    const today = upcomingReminders(half, morning).filter(
      (t) => t.toISOString().slice(0, 10) === "2026-09-09",
    );
    expect(today).toHaveLength(1);
    expect(today[0].getHours()).toBe(14);
  });

  it("still schedules tomorrow so it keeps working unopened", () => {
    const times = upcomingReminders(twiceDaily(), morning);
    expect(times.some((t) => t.toISOString().slice(0, 10) === "2026-09-10")).toBe(true);
  });

  it("skips a day the habit does not apply to", () => {
    // Mondays only: from Wednesday the next repetitions are on the 14th.
    const mondays = twiceDaily({ weekdays: [1] });
    const days = new Set(upcomingReminders(mondays, morning).map((t) => t.toISOString().slice(0, 10)));
    expect([...days]).toEqual(["2026-09-14"]);
  });

  it("leaves a one-off with exactly one reminder", () => {
    const once = task({ id: "o", kind: "one_off", dueAt: at("2026-09-09T20:00:00") });
    expect(upcomingReminders(once, morning)).toHaveLength(1);
  });
});
