"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useMoney } from "@/lib/use-money";
import { db } from "@/lib/db";
import { softDelete } from "@/lib/backup";
import type { AgentId, Capture } from "@/lib/types";

interface CaptureListProps {
  agent: AgentId;
  emptyLabel: string;
}

// "7h 30m" rather than "450 min": sleep is talked about in hours.
export function formatHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

function describe(capture: Capture, formatMoney: (v: number) => string): string {
  switch (capture.kind) {
    case "expense":
      return `${formatMoney(capture.amount ?? 0)} - ${capture.label}` +
        (capture.account ? ` (${capture.account})` : "");
    case "workout":
      return capture.durationMinutes
        ? `${capture.label} - ${capture.durationMinutes} min`
        : capture.label;
    case "event":
      return capture.scheduledFor
        ? `${capture.label} - ${new Date(capture.scheduledFor).toLocaleString()}`
        : capture.label;
    case "sleep":
      return capture.durationMinutes
        ? `Slept ${formatHours(capture.durationMinutes)}`
        : capture.label;
    case "meal":
      return capture.label;
  }
}

export function CaptureList({ agent, emptyLabel }: CaptureListProps) {
  const { formatMoney } = useMoney();
  const captures = useLiveQuery(
    () => db.captures.where("agent").equals(agent).reverse().sortBy("capturedAt"),
    [agent],
  );

  if (!captures) return null;

  if (captures.length === 0) {
    return <p className="px-4 text-sm text-foreground-muted">{emptyLabel}</p>;
  }

  return (
    <ul className="flex flex-col gap-2 px-4">
      {captures.map((capture) => (
        <li
          key={capture.id}
          className="flex items-start justify-between gap-3 rounded-xl border border-border bg-background-elevated p-3"
        >
          <div>
            <p className="text-sm">{describe(capture, formatMoney)}</p>
            {/* The user's own words, so a mis-parse is visibly recoverable. */}
            <p className="mt-0.5 text-xs text-foreground-muted">&ldquo;{capture.raw}&rdquo;</p>
          </div>
          <button
            onClick={() => softDelete("captures", capture.id)}
            className="shrink-0 text-xs text-foreground-muted underline"
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}
