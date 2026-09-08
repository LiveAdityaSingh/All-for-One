"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { softDelete } from "@/lib/backup";
import { isDoneForNow } from "@/lib/tasks";
import { useAgentName } from "@/lib/use-agent-names";
import { TASK_KIND_LABELS } from "@/lib/types";

// The main screen hides finished work so today stays legible. Everything
// ever added lives here, which is also the only place a completed task can
// be found again.
export default function TaskRecordsPage() {
  const name = useAgentName("lisa");
  const tasks = useLiveQuery(() => db.tasks.orderBy("createdAt").reverse().toArray(), []);

  const rows = tasks ?? [];
  const done = rows.filter((t) => isDoneForNow(t)).length;

  return (
    <div className="flex flex-col gap-4 px-4">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: "var(--color-lisa)" }}>
          Everything tracked
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Every task {name} holds, newest first
          {done > 0 ? `, including ${done} already done` : ""}.
        </p>
      </div>

      {rows.length === 0 && <p className="text-sm text-foreground-muted">Nothing added yet.</p>}

      <ul className="flex flex-col gap-2">
        {rows.map((task) => {
          const finished = isDoneForNow(task);
          return (
            <li
              key={task.id}
              className="lip flex items-center gap-3 rounded-xl border border-border bg-background-elevated p-3"
            >
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm ${finished ? "text-foreground-muted line-through" : ""}`}>
                  {task.title}
                </p>
                <p className="text-xs text-foreground-muted">
                  {TASK_KIND_LABELS[task.kind]}
                  {task.dueAt ? ` · ${new Date(task.dueAt).toLocaleString()}` : ""}
                </p>
              </div>
              <button
                onClick={() => softDelete("tasks", task.id)}
                className="shrink-0 text-xs text-foreground-muted underline"
              >
                Remove
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
