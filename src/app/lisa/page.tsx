"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { ChatInputBar } from "@/components/chat-input-bar";
import { db } from "@/lib/db";
import { useAgentName } from "@/lib/use-agent-names";
import { softDelete } from "@/lib/backup";
import { addTask, isDoneForNow, isOverdue, toggleTask } from "@/lib/tasks";
import { TASK_KIND_LABELS, type Task, type TaskKind } from "@/lib/types";

const KINDS: TaskKind[] = ["one_off", "daily", "monthly", "milestone"];

function TaskRow({ task }: { task: Task }) {
  const done = isDoneForNow(task);
  const overdue = isOverdue(task);

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
        {done && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth={4}>
            <path d="M4 12l6 6L20 5" />
          </svg>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <p className={`text-sm ${done ? "text-foreground-muted line-through" : ""}`}>
          {task.title}
        </p>
        <p className="text-xs text-foreground-muted">
          {TASK_KIND_LABELS[task.kind]}
          {task.dueAt && ` - ${new Date(task.dueAt).toLocaleString()}`}
        </p>
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

      <button
        onClick={() => softDelete("tasks", task.id)}
        className="shrink-0 text-xs text-foreground-muted underline"
      >
        Remove
      </button>
    </li>
  );
}

export default function LisaPage() {
  const name = useAgentName("lisa");
  const tasks = useLiveQuery(() => db.tasks.orderBy("createdAt").reverse().toArray(), []);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<TaskKind>("one_off");
  const [due, setDue] = useState("");

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    await addTask(title, kind, due ? new Date(due) : null);
    setTitle("");
    setDue("");
  }

  const open = tasks?.filter((t) => !isDoneForNow(t)) ?? [];
  const done = tasks?.filter((t) => isDoneForNow(t)) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between px-4">
        <h1 className="agent-text-glow text-lg font-semibold"
          style={{ color: "var(--color-lisa)", ["--glow" as string]: "var(--color-lisa)" }}>
          {name}
        </h1>
        {/* Open loops shown as a persistent count (build spec §11). */}
        {open.length > 0 && (
          <span className="text-xs text-foreground-muted">
            {open.length} open
          </span>
        )}
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
                {TASK_KIND_LABELS[k]}
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
      </form>

      {open.length === 0 && done.length === 0 && (
        <p className="px-4 text-sm text-foreground-muted">
          Nothing scheduled. Try &ldquo;remind me to call the plumber at 5pm&rdquo;.
        </p>
      )}

      {open.length > 0 && (
        <ul className="flex flex-col gap-2 px-4">
          {open.map((task) => <TaskRow key={task.id} task={task} />)}
        </ul>
      )}

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
