"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { AgentHeader } from "@/components/agent-header";
import { ChatInputBar } from "@/components/chat-input-bar";
import { ExampleRows } from "@/components/example-rows";
import { HabitStreaks } from "@/components/habit-streaks";
import { isOnlyDefault } from "@/lib/seed";
import { InlineEdit } from "@/components/inline-edit";
import { ScoreCard } from "@/components/score-card";
import { followThrough } from "@/lib/agent-scores";
import { db } from "@/lib/db";
import { useHasMounted } from "@/lib/use-has-mounted";
import { canHandOff, handoffFor, openHandoff } from "@/lib/handoff";
import { MAX_SCHEDULED } from "@/lib/reminders";
import { Capacitor } from "@capacitor/core";
import { softDelete } from "@/lib/backup";
import { appliesOn, doneToday, isDoneForNow, isOverdue, timesPerDay, toggleTask } from "@/lib/tasks";
import { TASK_KIND_LABELS, WEEKDAY_NAMES, type Task } from "@/lib/types";

// "Habit" on its own says nothing about the rhythm you chose, so the row
// spells it back: which days, and how far through today you are.
function describeRhythm(task: Task, now = new Date()): string {
  const parts = [TASK_KIND_LABELS[task.kind]];

  if (task.kind === "habit") {
    const days = task.weekdays;
    if (days && days.length > 0 && days.length < 7) {
      parts.push([...days].sort().map((d) => WEEKDAY_NAMES[d].slice(0, 3)).join(", "));
    } else {
      parts.push("every day");
    }

    const target = timesPerDay(task);
    if (target > 1) parts.push(`${doneToday(task, now)} of ${target} today`);
    else if (!appliesOn(task, now)) parts.push("not today");
  }

  if (task.dueAt) parts.push(new Date(task.dueAt).toLocaleString());
  return parts.join(" · ");
}

function TaskRow({ task }: { task: Task }) {
  const done = isDoneForNow(task);
  const overdue = isOverdue(task);
  // Which browser this is can only be known on the device, so the offer
  // must not be decided during the build-time render.
  const hasMounted = useHasMounted();
  const dueAt = task.dueAt;
  // Near enough for an alarm, or far enough that only a dated calendar
  // entry would land on the right day.
  const handoff = hasMounted && !done ? handoffFor(dueAt) : "none";

  return (
    <li className="lip flex items-center gap-3 rounded-xl border border-border bg-background-elevated p-3">
      <button
        onClick={() => toggleTask(task)}
        aria-label={done ? "Mark not done" : "Mark done"}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border"
        style={{
          borderColor: done ? "var(--color-lisa)" : "var(--border)",
          backgroundColor: done ? "var(--color-lisa)" : "transparent",
        }}
      >
        {task.kind === "habit" && timesPerDay(task) > 1 ? (
          <span
            className="text-[10px] font-semibold tabular-nums"
            style={{ color: done ? "var(--background)" : "var(--color-lisa)" }}
          >
            {doneToday(task)}
          </span>
        ) : (
          done && (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth={4}>
              <path d="M4 12l6 6L20 5" />
            </svg>
          )
        )}
      </button>

      <div className="min-w-0 flex-1">
        <InlineEdit
          value={task.title}
          label="task name"
          onSave={(title) => db.tasks.update(task.id, { title })}
          className={`text-sm ${done ? "text-foreground-muted line-through" : ""}`}
        />
        <p className="text-xs text-foreground-muted">{describeRhythm(task)}</p>
      </div>

      {/* Severity is structural, never a hue: hue is spoken for by agent
          identity (build spec §4), so overdue is a dot plus explicit words. */}
      {overdue && (
        <span className="flex shrink-0 items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: "var(--color-overdue)" }}
          />
          <span className="text-xs" style={{ color: "var(--color-overdue)" }}>
            Overdue
          </span>
        </span>
      )}

      {/* The app itself cannot ring; the clock app and the calendar can.
          This hands the reminder over rather than pretending otherwise. */}
      {handoff !== "none" && dueAt && (
        <button
          onClick={() => openHandoff(handoff, task.title, new Date(dueAt))}
          className="shrink-0 rounded-full border px-2.5 py-1 text-xs"
          style={{ borderColor: "var(--color-lisa-muted)", color: "var(--color-lisa)" }}
        >
          {handoff === "alarm" ? "Set alarm" : "Add to calendar"}
        </button>
      )}

      <button
        onClick={() => softDelete("tasks", task.id)}
        className="shrink-0 text-xs text-foreground-muted underline"
      >
        Remove
      </button>
    </li>
  );
}

function AlarmNote() {
  const hasMounted = useHasMounted();
  if (!hasMounted) return null;

  // The installed app can schedule a real alert; a web page cannot, which
  // is the whole reason the clock-app handoff exists.
  if (Capacitor.isNativePlatform()) {
    return (
      <p className="px-4 text-xs text-foreground-muted">
        Dated reminders alert you at the time you set, even with the app closed.
        The nearest {MAX_SCHEDULED} are kept scheduled; anything further out is
        picked up later.
      </p>
    );
  }

  return (
    <p className="px-4 text-xs text-foreground-muted">
      {canHandOff()
        ? "This app can't ring on its own, so a dated reminder hands itself to one that can: your clock app within the next day, your calendar beyond it. An alarm has no date, so anything further out would ring on the wrong one."
        : "Reminders are kept here, not alerted. Passing one to the phone's clock app or calendar needs Chrome on Android; this browser has nothing to hand it to."}
    </p>
  );
}

export default function LisaPage() {
  const tasks = useLiveQuery(() => db.tasks.orderBy("createdAt").reverse().toArray(), []);

  const open = tasks?.filter((t) => !isDoneForNow(t)) ?? [];
  const done = tasks?.filter((t) => isDoneForNow(t)) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <AgentHeader
        agent="lisa"
        subtitle="Reminders, habits and milestones"
        items={[
          { label: "Add reminder", href: "/lisa/new", hint: "A time, a rhythm, or an end" },
          { label: "Everything tracked", href: "/lisa/records", hint: "Including everything done" },
        ]}
      >
        {/* Open loops shown as a persistent count (build spec §11). */}
        {open.length > 0 && (
          <span className="text-xs text-foreground-muted">{open.length} open</span>
        )}
      </AgentHeader>

      <ScoreCard agent="lisa" score={followThrough(tasks ?? [])} />

      <HabitStreaks tasks={tasks ?? []} />

      {open.length > 0 && (
        <ul className="flex flex-col gap-2 px-4">
          {open.map((task) => <TaskRow key={task.id} task={task} />)}
        </ul>
      )}

      {isOnlyDefault((tasks ?? []).map((t) => t.id)) && (
        <ExampleRows
          agent="lisa"
          intro={
            open.length > 0
              ? "That one is a suggestion to get you going. These are the four kinds of thing this screen holds:"
              : "Nothing here yet. These are the four kinds of thing this screen holds:"
          }
          rows={[
            {
              primary: "Call the plumber",
              secondary: "One-off · today at 5pm",
              how: "remind me to call the plumber at 5pm",
              spoken: true,
            },
            {
              primary: "Stretch for ten minutes",
              secondary: "Habit · your days, your count, builds a streak",
              how: "Choose New habit under Add reminder, then pick your days.",
            },
            {
              primary: "Pay the rent",
              secondary: "Monthly · counts once a month",
              how: "Choose Monthly under Add reminder.",
            },
            {
              primary: "Finish the portfolio site",
              secondary: "Milestone · no reset, just done or not",
              how: "Choose Milestone for something with an end rather than a rhythm.",
            },
          ]}
        />
      )}

      <AlarmNote />

      {done.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="px-4 text-xs text-foreground-muted">Done</h2>
          <ul className="flex flex-col gap-2 px-4">
            {done.map((task) => <TaskRow key={task.id} task={task} />)}
          </ul>
        </div>
      )}

      <ChatInputBar variant="agent" placeholder="e.g. remind me to call the plumber at 5pm" />
    </div>
  );
}
