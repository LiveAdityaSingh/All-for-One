"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { addTask } from "@/lib/tasks";
import { useAgentName } from "@/lib/use-agent-names";
import {
  TASK_KIND_PICKER_LABELS,
  WEEKDAY_LABELS,
  WEEKDAY_NAMES,
  type TaskKind,
} from "@/lib/types";

const KINDS: TaskKind[] = ["one_off", "habit", "daily", "monthly", "milestone"];

// Adding something is a deliberate act, so it gets its own screen rather
// than a permanent form above the list. The Daily screen is for reading
// what you owe; this is for adding to it.
export default function NewReminderPage() {
  const router = useRouter();
  const name = useAgentName("lisa");

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
    router.push("/lisa");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="px-4">
        <h1 className="text-lg font-semibold" style={{ color: "var(--color-lisa)" }}>
          Add a reminder
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Anything with a time, a rhythm, or an end. {name} keeps it either way.
        </p>
      </div>

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
    </div>
  );
}
