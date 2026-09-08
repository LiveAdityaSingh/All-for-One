"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { softDelete } from "@/lib/backup";
import { useAgentName } from "@/lib/use-agent-names";
import { STAGE_LABELS } from "@/lib/types";

// The main screen is deliberately about what is still live. This is the
// other half: everything ever tracked, including the closed ones, because
// a rejection you can still see is evidence of effort rather than a gap.
export default function ApplicationRecordsPage() {
  const name = useAgentName("tony");
  const applications = useLiveQuery(
    () => db.applications.orderBy("appliedAt").reverse().toArray(),
    [],
  );

  const rows = applications ?? [];
  const closed = rows.filter((a) => a.stage === "rejected" || a.stage === "withdrawn").length;

  return (
    <div className="flex flex-col gap-4 px-4">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: "var(--color-tony)" }}>
          Everything tracked
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Every application {name} holds, newest first
          {closed > 0 ? `, including ${closed} closed` : ""}.
        </p>
      </div>

      {rows.length === 0 && (
        <p className="text-sm text-foreground-muted">Nothing logged yet.</p>
      )}

      <ul className="flex flex-col gap-2">
        {rows.map((app) => {
          const dead = app.stage === "rejected" || app.stage === "withdrawn";
          return (
            <li
              key={app.id}
              className="lip flex items-center gap-3 rounded-xl border border-border bg-background-elevated p-3"
            >
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-medium ${dead ? "text-foreground-muted" : ""}`}>
                  {app.company}
                </p>
                <p className="truncate text-xs text-foreground-muted">
                  {app.role} · applied {new Date(app.appliedAt).toLocaleDateString()}
                </p>
              </div>
              <span
                className="shrink-0 rounded-full px-2 py-1 text-xs font-medium"
                style={{
                  backgroundColor: dead ? "var(--color-stale)" : "var(--color-tony-muted)",
                  color: "var(--background)",
                }}
              >
                {STAGE_LABELS[app.stage]}
              </span>
              <button
                onClick={() => softDelete("applications", app.id)}
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
