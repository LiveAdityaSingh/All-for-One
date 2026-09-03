"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { CaptureList } from "@/components/capture-list";
import { ChatInputBar } from "@/components/chat-input-bar";
import { db } from "@/lib/db";
import { useAgentName } from "@/lib/use-agent-names";
import { buildWeeklyReport, describeTrend } from "@/lib/health";

export default function MarcoPage() {
  const name = useAgentName("marco");
  const captures = useLiveQuery(() => db.captures.toArray(), []);
  const report = buildWeeklyReport(captures ?? []);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="agent-text-glow px-4 text-lg font-semibold"
        style={{ color: "var(--color-marco)", ["--glow" as string]: "var(--color-marco)" }}>
        {name}
      </h1>

      {/*
        Descriptive, never prescriptive (build spec §9). This reports what
        was logged and how it moved; it never says what the user should do
        about it, and never interprets symptoms.
      */}
      <div
        className="mx-4 flex flex-col gap-1 rounded-xl border p-4"
        style={{
          borderColor: "var(--color-marco-muted)",
          backgroundColor: "color-mix(in oklch, var(--color-marco) 10%, transparent)",
        }}
      >
        <p className="text-xs text-foreground-muted">This week</p>
        <p className="text-3xl font-semibold" style={{ color: "var(--color-marco)" }}>
          {report.sessions} session{report.sessions === 1 ? "" : "s"}
        </p>
        {report.totalMinutes > 0 && (
          <p className="text-xs text-foreground-muted">
            {report.totalMinutes} minutes logged
          </p>
        )}
        <p className="mt-1 text-xs text-foreground-muted">{describeTrend(report)}</p>
      </div>

      {report.byActivity.length > 0 && (
        <ul className="flex flex-col gap-1 px-4">
          {report.byActivity.map((row) => (
            <li
              key={row.activity}
              className="flex items-center justify-between rounded-lg border border-border bg-background-elevated px-3 py-2 text-sm"
            >
              <span>{row.activity}</span>
              <span className="text-xs text-foreground-muted">
                {row.sessions}×{row.minutes > 0 && ` · ${row.minutes} min`}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="px-4 text-xs text-foreground-muted">Logged sessions</h2>
        <CaptureList
          agent="marco"
          emptyLabel="Nothing logged yet. Try &ldquo;did 45 minutes legs&rdquo;."
        />
      </div>

      <ChatInputBar variant="agent" placeholder="e.g. did 45 minutes legs" />
    </div>
  );
}
