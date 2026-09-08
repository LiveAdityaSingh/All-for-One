// Per-task reminders (build spec §7).
//
// Until now a task's dueAt was stored and read by nothing: the only thing
// this app ever scheduled was the 8pm digest, so "remind me at 5pm" was a
// row in a list and nothing more. This is the piece that makes a dated
// task actually interrupt you, and it is the one thing the installed app
// can do that the web build cannot - a page cannot schedule a future
// alert, so on the web the clock-app handoff remains the only route.
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { db } from "./db";
import { getAgentNames } from "./agent-names";
import { ensureNotificationPermission } from "./notifications";
import { appliesOn, doneToday, isDoneForNow, timesPerDay } from "./tasks";
import type { Task } from "./types";

// Android keeps every pending alarm in memory in system_server, and a
// runaway list is a real way to get an app killed. Only the nearest few
// are ever registered; the rest are picked up on a later sync, because a
// reminder months away has many launches in which to be scheduled.
export const MAX_SCHEDULED = 64;

// The digest owns id 1. Reminders start far above it so the two can never
// cancel one another.
export const REMINDER_ID_FLOOR = 1000;

// Task ids are strings and Android wants a 32-bit int, so the id has to be
// derived rather than assigned - a counter would not survive a reinstall,
// and the same task must map to the same notification every time or a
// reschedule would leave the old one behind. FNV-1a, folded into the range
// above the digest.
export function notificationIdFor(taskId: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < taskId.length; i++) {
    hash ^= taskId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return REMINDER_ID_FLOOR + (hash % (0x7fffffff - REMINDER_ID_FLOOR));
}

export interface ScheduledReminder {
  task: Task;
  at: Date;
  // Which repetition of the day this is, 0-based. A habit done three times
  // a day rings three times, and each needs its own notification id.
  occurrence: number;
}

// A habit's repetitions are spread across a waking day rather than fired
// together: three times a day means morning, midday and evening, not three
// pings at eight in the morning.
export const ACTIVE_HOURS = 12;

// Clamps a day-of-month onto a month that may be shorter: a reminder set
// for the 31st lands on the 30th in April rather than silently jumping
// into May.
function onDayOfMonth(base: Date, day: number): Date {
  const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const at = new Date(base);
  at.setDate(Math.min(day, lastDay));
  return at;
}

// When a task should next interrupt you.
//
// A repeating task carries one dueAt, which is the first occurrence and
// not the only one. Scheduling that instant directly meant a daily task
// fired once and then never again, because every later sync saw a time in
// the past and skipped it - so the habit half of this screen quietly did
// nothing after day one.
export function nextReminderAt(task: Task, now: Date = new Date()): Date | null {
  if (!task.dueAt) return null;

  const due = new Date(task.dueAt);
  if (Number.isNaN(due.getTime())) return null;

  // Something with an end rather than a rhythm: it fires once, if at all.
  if (task.kind === "one_off" || task.kind === "milestone") {
    if (task.completedAt) return null;
    return due.getTime() > now.getTime() ? due : null;
  }

  // Ticked for this period already, so the next one is owed instead.
  const settled = isDoneForNow(task, now);

  if (task.kind === "daily" || task.kind === "habit") {
    const at = new Date(now);
    at.setHours(due.getHours(), due.getMinutes(), 0, 0);
    if (settled || at.getTime() <= now.getTime()) at.setDate(at.getDate() + 1);

    // A habit set to certain weekdays should not ring on the others, so
    // walk forward to the next day it actually applies to. Bounded by a
    // week, because seven steps always find one when any day is selected.
    for (let i = 0; i < 7 && !appliesOn(task, at); i++) {
      at.setDate(at.getDate() + 1);
    }
    return appliesOn(task, at) ? at : null;
  }

  const thisMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
    due.getHours(),
    due.getMinutes(),
    0,
    0,
  );
  let at = onDayOfMonth(thisMonth, due.getDate());
  if (settled || at.getTime() <= now.getTime()) {
    const next = new Date(thisMonth);
    next.setMonth(next.getMonth() + 1, 1);
    at = onDayOfMonth(next, due.getDate());
  }
  return at;
}

// The clock times a habit's repetitions fall on for a given day, starting
// at the time you set and spread evenly across the waking window.
function habitSlots(task: Task, day: Date, due: Date): Date[] {
  const count = timesPerDay(task);
  const spacing = (ACTIVE_HOURS * 60 * 60 * 1000) / count;
  const first = new Date(day);
  first.setHours(due.getHours(), due.getMinutes(), 0, 0);
  return Array.from({ length: count }, (_, i) => new Date(first.getTime() + i * spacing));
}

// Every time this task should still ring. One entry for anything that is
// not a habit; for a habit, the repetitions left today plus the whole of
// the next day it applies to, so something is always scheduled ahead even
// if the app is not opened again today.
export function upcomingReminders(task: Task, now: Date = new Date()): Date[] {
  if (!task.dueAt) return [];
  const due = new Date(task.dueAt);
  if (Number.isNaN(due.getTime())) return [];

  if (task.kind !== "habit") {
    const at = nextReminderAt(task, now);
    return at ? [at] : [];
  }

  const times: Date[] = [];

  if (appliesOn(task, now)) {
    // Repetitions already ticked off today do not ring again.
    const done = doneToday(task, now);
    habitSlots(task, now, due).forEach((slot, i) => {
      if (i >= done && slot.getTime() > now.getTime()) times.push(slot);
    });
  }

  const nextDay = new Date(now);
  for (let i = 0; i < 8; i++) {
    nextDay.setDate(nextDay.getDate() + 1);
    if (appliesOn(task, nextDay)) {
      times.push(...habitSlots(task, nextDay, due));
      break;
    }
  }

  return times;
}

// What *should* be scheduled right now. Pure, so the rules can be tested
// without a device: nothing in the past, nothing already settled, soonest
// first, and never more than the cap.
export function dueReminders(
  tasks: Task[],
  now: Date = new Date(),
  limit: number = MAX_SCHEDULED,
): ScheduledReminder[] {
  return tasks
    .flatMap((task) =>
      upcomingReminders(task, now).map((at, occurrence) => ({ task, at, occurrence })),
    )
    .filter((r) => r.at.getTime() > now.getTime())
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, limit);
}

// Reconciles the OS against the database rather than tracking individual
// schedule calls: every sync cancels what this module owns and re-registers
// the current set. Idempotent, and it self-heals after a reboot, a restore
// or a permission finally being granted.
export async function syncReminders(now: Date = new Date()): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (!(await ensureNotificationPermission())) return;

  try {
    const wanted = dueReminders(await db.tasks.toArray(), now);

    const pending = await LocalNotifications.getPending();
    const ours = pending.notifications.filter((n) => n.id >= REMINDER_ID_FLOOR);
    if (ours.length > 0) {
      await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
    }
    if (wanted.length === 0) return;

    // Whatever the user calls Lisa is what the notification is from.
    const from = getAgentNames().lisa;

    await LocalNotifications.schedule({
      notifications: wanted.map(({ task, at, occurrence }) => ({
        // Each repetition needs its own id, or the second one would cancel
        // the first when they are registered together.
        id: notificationIdFor(occurrence === 0 ? task.id : `${task.id}#${occurrence}`),
        title: from,
        body: task.title,
        schedule: {
          at,
          // OEM battery killers drop inexact background work regardless of
          // what the docs promise (build spec §12), so a reminder the user
          // set a time for has to be an exact alarm.
          allowWhileIdle: true,
        },
        extra: { taskId: task.id },
      })),
    });
  } catch {
    // A reminder that fails to register must never break the capture that
    // triggered it - the task itself is already saved by this point.
  }
}

let pendingSync: ReturnType<typeof setTimeout> | null = null;

function requestSync(): void {
  if (pendingSync) clearTimeout(pendingSync);
  // A single capture can write several rows; one sync afterwards is enough.
  pendingSync = setTimeout(() => {
    pendingSync = null;
    void syncReminders();
  }, 500);
}

let installed = false;

// Driven by database hooks rather than by call sites, for the same reason
// modifiedAt is: a hook cannot be forgotten the way a call can, and tasks
// are written from the Lisa screen, from voice capture and from undo.
export function installReminderSync(): void {
  if (installed || !Capacitor.isNativePlatform()) return;
  installed = true;

  const table = db.tasks as unknown as {
    hook(event: "creating" | "updating" | "deleting", fn: () => void): void;
  };
  table.hook("creating", requestSync);
  table.hook("updating", requestSync);
  table.hook("deleting", requestSync);
}
