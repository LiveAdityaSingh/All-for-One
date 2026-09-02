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

export function isDoneForNow(task: Task, now: Date = new Date()): boolean {
  if (task.kind === "one_off" || task.kind === "milestone") {
    return task.completedAt !== null;
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

export async function addTask(
  title: string,
  kind: TaskKind,
  dueAt: Date | null,
): Promise<string> {
  const id = nanoid();
  await db.tasks.add({
    id,
    title: title.trim(),
    kind,
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
