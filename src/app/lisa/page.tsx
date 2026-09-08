"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { AgentHeader } from "@/components/agent-header";
import { ChatInputBar } from "@/components/chat-input-bar";
import { ExampleRows } from "@/components/example-rows";
import { InlineEdit } from "@/components/inline-edit";
import { ScoreCard } from "@/components/score-card";
import { followThrough } from "@/lib/agent-scores";
import { db } from "@/lib/db";
import { useHasMounted } from "@/lib/use-has-mounted";
import { canHandOff, handoffFor, openHandoff } from "@/lib/handoff";
import { MAX_SCHEDULED } from "@/lib/reminders";
import { Capacitor } from "@capacitor/core";
import { softDelete } from "@/lib/backup";
import { addTask, appliesOn, doneToday, isDoneForNow, isOverdue, timesPerDay, toggleTask } from "@/lib/tasks";
import {
  TASK_KIND_LABELS,
  TASK_KIND_PICKER_LABELS,
  WEEKDAY_LABELS,
  WEEKDAY_NAMES,
  type Task,
  type TaskKind,
} from "@/lib/types";

const KINDS: TaskKind[] = ["one_off", "habit", "daily", "monthly", "milestone"];

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
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<TaskKind>("one_off");
  const [due, setDue] = useState("");
  // Habit rhythm. Empty weekdays means every day, which is the sensible
  // reading of "I did not narrow it down".
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [times, setTimes] = useState(1);

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    await addTask(title, kind, due ? new Date(due) : null, {
      weekdays: weekdays.length > 0 ? [...weekdays].sort() : null,
      timesPerDay: times,
    });
    setTitle("");
    setDue("");
    setWeekdays([]);
    setTimes(1);
  }

  const open = tasks?.filter((t) => !isDoneForNow(t)) ?? [];
  const done = tasks?.filter((t) => isDoneForNow(t)) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <AgentHeader
        agent="lisa"
        subtitle="Reminders, habits and milestones"
        items={[
          { label: "Everything tracked", href: "/lisa/records", hint: "Including everything done" },
        ]}
      >
        {/* Open loops shown as a persistent count (build spec §11). */}
        {open.length > 0 && (
          <span className="text-xs text-foreground-muted">{open.length} open</span>
        )}
      </AgentHeader>

      <ScoreCard agent="lisa" score={followThrough(tasks ?? [])} />

      <form onSubmit={handleAdd} className="flex flex-col gap-2 px-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task or milestone"
          className="rounded-lg border border-border bg-background-elevated px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as TaskKind)}
            className="flex-1 rounded-lg border border-border bg-background-elevated px-3 py-2 text-sm"
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {TASK_KIND_PICKER_LABELS[k]}
              </option>
            ))}
          </select>
          <input
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-background-elevated px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-full px-4 py-2 text-sm font-medium"
            style={{ backgroundColor: "var(--color-lisa)", color: "var(--background)" }}
          >
            Add
          </button>
        </div>

        {/* Only a habit has a rhythm to describe, so the controls for one
            appear only when you are making one. */}
        {kind === "habit" && (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-background-elevated p-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-foreground-muted">
                Which days {weekdays.length === 0 && "· every day unless you pick some"}
              </span>
              <div className="flex gap-1.5">
                {WEEKDAY_LABELS.map((label, day) => {
                  const on = weekdays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={on}
                      aria-label={WEEKDAY_NAMES[day]}
                      onClick={() =>
                        setWeekdays((current) =>
                          current.includes(day)
                            ? current.filter((d) => d !== day)
                            : [...current, day],
                        )
                      }
                      className="h-9 flex-1 rounded-lg border text-xs font-medium"
                      style={{
                        borderColor: on ? "var(--color-lisa)" : "var(--border)",
                        color: on ? "var(--background)" : "var(--foreground-muted)",
                        backgroundColor: on ? "var(--color-lisa)" : "transparent",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="flex items-center justify-between gap-2">
              <span className="text-xs text-foreground-muted">Times a day</span>
              <input
                type="number"
                min={1}
                max={12}
                value={times}
                onChange={(e) => setTimes(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
                className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-right text-sm"
              />
            </label>
          </div>
        )}
      </form>

      {open.length === 0 && done.length === 0 && (
        <ExampleRows
          agent="lisa"
          intro="Nothing here yet. These are the four kinds of thing this screen holds:"
          rows={[
            {
              primary: "Call the plumber",
              secondary: "One-off · today at 5pm",
              how: "remind me to call the plumber at 5pm",
              spoken: true,
            },
            {
              primary: "Stretch for ten minutes",
              secondary: "Daily · resets every morning",
              how: "Pick Daily in the form above; ticking it counts for today only.",
            },
            {
              primary: "Pay the rent",
              secondary: "Monthly · counts once a month",
              how: "Pick Monthly in the form above.",
            },
            {
              primary: "Finish the portfolio site",
              secondary: "Milestone · no reset, just done or not",
              how: "Pick Milestone for something with an end rather than a rhythm.",
            },
          ]}
        />
      )}

      {open.length > 0 && (
        <ul className="flex flex-col gap-2 px-4">
          {open.map((task) => <TaskRow key={task.id} task={task} />)}
        </ul>
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
