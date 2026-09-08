"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db } from "@/lib/db";
import { computeBodyPotential } from "@/lib/body-potential";
import { getBodyMetrics } from "@/lib/metrics";
import { softDelete } from "@/lib/backup";
import { InlineEdit } from "@/components/inline-edit";
import { formatHours } from "@/components/capture-list";
import { useAgentName } from "@/lib/use-agent-names";
import type { Capture, CaptureKind } from "@/lib/types";

const FILTERS: { key: CaptureKind | "all"; label: string }[] = [
  { key: "all", label: "Everything" },
  { key: "workout", label: "Movement" },
  { key: "sleep", label: "Sleep" },
  { key: "meal", label: "Fuel" },
];

function describe(capture: Capture): string {
  if (capture.kind === "sleep") {
    return capture.durationMinutes ? formatHours(capture.durationMinutes) : "Sleep";
  }
  if (capture.kind === "workout") {
    return capture.durationMinutes
      ? `${capture.label} - ${capture.durationMinutes} min`
      : capture.label;
  }
  return capture.label;
}

// Grouped by day rather than listed flat: what you want from a history is
// "what did a Tuesday look like", not a scroll of timestamps.
function dayLabel(iso: string, now: Date): string {
  const date = new Date(iso);
  const key = (d: Date) => d.toISOString().slice(0, 10);
  if (key(date) === key(now)) return "Today";
  const yesterday = new Date(now.getTime() - 86400000);
  if (key(date) === key(yesterday)) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
}

export default function HealthRecordsPage() {
  const name = useAgentName("marco");
  const [filter, setFilter] = useState<CaptureKind | "all">("all");

  const captures = useLiveQuery(
    () => db.captures.where("agent").equals("marco").reverse().sortBy("capturedAt"),
    [],
  );
  const metrics = useLiveQuery(() => getBodyMetrics(), []);

  // The Health screen shows only the headline number, so the arithmetic
  // behind it lives here - a score you cannot take apart is one you either
  // over-trust or ignore.
  const potential = computeBodyPotential(captures ?? [], metrics);

  const rows = (captures ?? []).filter((c) => filter === "all" || c.kind === filter);
  const now = new Date();

  const days = new Map<string, Capture[]>();
  for (const row of rows) {
    const label = dayLabel(row.capturedAt, now);
    days.set(label, [...(days.get(label) ?? []), row]);
  }

  return (
    <div className="flex flex-col gap-4 px-4">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: "var(--color-marco)" }}>
          Everything logged
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Every health record {name} holds, newest first. Nothing here has been
          interpreted &mdash; it is what you said, when you said it.
        </p>
      </div>

      <section className="lip flex flex-col gap-3 rounded-xl border border-border bg-background-elevated p-3">
        <p className="text-[10px] uppercase tracking-wider text-foreground-muted">
          What the score was made of
        </p>
        {potential.components.map((component) => (
          <div key={component.key} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium">{component.label}</span>
              <span
                className="text-xs tabular-nums"
                style={{
                  color: component.score === null ? "var(--color-stale)" : "var(--color-marco)",
                }}
              >
                {component.score === null ? "not logged" : `${component.score}%`}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--border)" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${component.score ?? 0}%`,
                  backgroundColor:
                    component.score === null ? "var(--color-stale)" : "var(--color-marco)",
                }}
              />
            </div>
            <span className="text-[11px] text-foreground-muted">{component.detail}</span>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="rounded-full border px-3 py-1 text-xs"
              style={{
                borderColor: active ? "var(--color-marco)" : "var(--border)",
                color: active ? "var(--color-marco)" : "var(--foreground-muted)",
                backgroundColor: active
                  ? "color-mix(in oklch, var(--color-marco) 14%, transparent)"
                  : "transparent",
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {rows.length === 0 && (
        <p className="text-sm text-foreground-muted">
          {captures?.length === 0
            ? "Nothing logged yet."
            : "Nothing of that kind logged yet."}
        </p>
      )}

      {[...days.entries()].map(([label, items]) => (
        <section key={label} className="flex flex-col gap-2">
          <h2 className="text-xs uppercase tracking-wider text-foreground-muted">{label}</h2>
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="lip flex items-center gap-3 rounded-xl border border-border bg-background-elevated p-3"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: "var(--color-marco)" }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  {/* Sleep reads as a duration rather than a label, so only
                      the ones whose text is the record are editable here. */}
                  {item.kind === "sleep" ? (
                    <p className="truncate text-sm">{describe(item)}</p>
                  ) : (
                    <InlineEdit
                      value={item.label}
                      label="what this was"
                      onSave={(label) => db.captures.update(item.id, { label })}
                      className="text-sm"
                    />
                  )}
                  <p className="text-xs text-foreground-muted">
                    {new Date(item.capturedAt).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {item.raw ? ` · "${item.raw}"` : ""}
                  </p>
                </div>
                <button
                  onClick={() => softDelete("captures", item.id)}
                  className="shrink-0 text-xs text-foreground-muted underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
