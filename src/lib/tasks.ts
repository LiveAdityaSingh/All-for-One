// Lisa's task rules (build spec §7). Repeating tasks are the awkward part:
// a daily task is never "done", it is done *today*, so completion is
// recorded as a date and compared against the current one rather than
// being a flag that would have to be reset by a background job.
import { db } from "./db";
import { nanoid } from "./id";
import type { Task, TaskKind } from "./types";

export function toDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// A habit set to Tuesdays and Thursdays owes you nothing on a Wednesday.
// Everything else applies every day it exists.
export function appliesOn(task: Task, now: Date = new Date()): boolean {
  if (task.kind !== "habit") return true;
  const days = task.weekdays;
  // No selection means every day, which is the sensible reading of "I did
  // not narrow it down".
  if (!days || days.length === 0) return true;
  return days.includes(now.getDay());
}

export function timesPerDay(task: Task): number {
  return Math.max(1, Math.round(task.timesPerDay ?? 1));
}

// How many of today's repetitions are done. The stored count belongs to
// whatever day it was last written on, so any other date reads as zero -
// which is how the daily reset happens without a background job.
export function doneToday(task: Task, now: Date = new Date()): number {
  if (task.lastCompletedOn !== toDayKey(now)) return 0;
  return Math.max(0, task.completedToday ?? (task.kind === "habit" ? 0 : 1));
}

// Three weeks is the point this app treats a habit as established. It is a
// round, widely-quoted figure rather than a scientific one, and it is used
// only to decide when to stop calling something new.
export const STREAK_TO_GRADUATE = 21;

// The last day before `from` that this habit actually applied to. A habit
// set to Mondays does not break its streak by being skipped on a Tuesday.
export function previousApplicableDay(task: Task, from: Date): Date | null {
  const day = new Date(from);
  for (let i = 0; i < 8; i++) {
    day.setDate(day.getDate() - 1);
    if (appliesOn(task, day)) return day;
  }
  return null;
}

// A streak survives while it was extended either today or on the last day
// this habit applied to. Anything older means a day it applied to went
// unfinished, and the run is over.
export function currentStreak(task: Task, now: Date = new Date()): number {
  if (task.kind !== "habit") return 0;

  const streak = task.streak ?? 0;
  if (streak <= 0 || !task.streakDay) return 0;

  if (task.streakDay === toDayKey(now)) return streak;

  const previous = previousApplicableDay(task, now);
  return previous && task.streakDay === toDayKey(previous) ? streak : 0;
}

export function isDoneForNow(task: Task, now: Date = new Date()): boolean {
  if (task.kind === "one_off" || task.kind === "milestone") {
    return task.completedAt !== null;
  }

  // Nothing owed on a day it does not apply to, so it is not outstanding.
  if (!appliesOn(task, now)) return true;

  if (task.kind === "habit") {
    return doneToday(task, now) >= timesPerDay(task);
  }

  if (!task.lastCompletedOn) return false;

  if (task.kind === "daily") {
    return task.lastCompletedOn === toDayKey(now);
  }

  // Monthly: done if it was ticked within the current calendar month.
  return task.lastCompletedOn.slice(0, 7) === toDayKey(now).slice(0, 7);
}

export function isOverdue(task: Task, now: Date = new Date()): boolean {
  if (!task.dueAt || isDoneForNow(task, now)) return false;
  return new Date(task.dueAt).getTime() < now.getTime();
}

export interface HabitRhythm {
  weekdays?: number[] | null;
  timesPerDay?: number | null;
}

export async function addTask(
  title: string,
  kind: TaskKind,
  dueAt: Date | null,
  rhythm: HabitRhythm = {},
): Promise<string> {
  const id = nanoid();
  await db.tasks.add({
    id,
    title: title.trim(),
    kind,
    weekdays: kind === "habit" ? (rhythm.weekdays ?? null) : null,
    timesPerDay: kind === "habit" ? Math.max(1, rhythm.timesPerDay ?? 1) : null,
    completedToday: 0,
    dueAt: dueAt ? dueAt.toISOString() : null,
    completedAt: null,
    lastCompletedOn: null,
    createdAt: new Date().toISOString(),
  });
  return id;
}

export async function toggleTask(task: Task, now: Date = new Date()): Promise<void> {
  const done = isDoneForNow(task, now);

  if (task.kind === "one_off" || task.kind === "milestone") {
    await db.tasks.put({
      ...task,
      completedAt: done ? null : now.toISOString(),
    });
    return;
  }

  // A habit done three times a day counts up rather than flipping, and
  // tapping it once more when the day is complete clears it - which is the
  // only way to correct a tap you did not mean.
  if (task.kind === "habit") {
    const target = timesPerDay(task);
    const current = doneToday(task, now);
    const next = current >= target ? 0 : current + 1;
    const today = toDayKey(now);
    const grewToday = task.streakDay === today;

    let streak = task.streak ?? 0;
    let streakDay = task.streakDay ?? null;

    if (next >= target && !grewToday) {
      // Today is finished: the run grows by one from wherever it stood.
      streak = currentStreak(task, now) + 1;
      streakDay = today;
    } else if (next === 0 && grewToday) {
      // Clearing a day that had been completed takes today's step back,
      // so a mis-tap does not leave a streak that was never earned.
      streak = Math.max(0, streak - 1);
      const previous = previousApplicableDay(task, now);
      streakDay = streak > 0 && previous ? toDayKey(previous) : null;
    }

    const graduating = streak >= STREAK_TO_GRADUATE;

    await db.tasks.put({
      ...task,
      completedToday: next,
      lastCompletedOn: today,
      streak,
      streakDay,
      // Three weeks in it is not a new habit any more, it is just something
      // you do - so it stops being tracked as one and becomes an ordinary
      // daily task, which is the whole point of building it.
      ...(graduating
        ? { kind: "daily" as const, weekdays: null, timesPerDay: null }
        : {}),
    });
    return;
  }

  await db.tasks.put({
    ...task,
    lastCompletedOn: done ? null : toDayKey(now),
  });
}

// Open loops are the retention mechanic (build spec §11, Zeigarnik): the
// count of things still awaiting the user, shown persistently.
export async function openTaskCount(now: Date = new Date()): Promise<number> {
  const tasks = await db.tasks.toArray();
  return tasks.filter((task) => !isDoneForNow(task, now)).length;
}
