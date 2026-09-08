"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { AgentHeader } from "@/components/agent-header";
import { BodyPotentialCard } from "@/components/body-potential-card";
import { CaptureList } from "@/components/capture-list";
import { ChatInputBar } from "@/components/chat-input-bar";
import { db } from "@/lib/db";
import { computeBodyPotential } from "@/lib/body-potential";
import { getBodyMetrics } from "@/lib/metrics";
import { buildWeeklyReport, describeTrend } from "@/lib/health";

export default function MarcoPage() {
  const captures = useLiveQuery(() => db.captures.toArray(), []);
  const metrics = useLiveQuery(() => getBodyMetrics(), []);

  const mine = (captures ?? []).filter((c) => c.agent === "marco");
  const potential = computeBodyPotential(mine, metrics);
  const report = buildWeeklyReport(mine);

  return (
    <div className="flex flex-col gap-4">
      <AgentHeader
        agent="marco"
        subtitle="Movement, sleep and fuel"
        items={[
          {
            label: "Your measurements",
            href: "/marco/metrics",
            hint: "Height, weight, year of birth",
          },
          {
            label: "Everything logged",
            href: "/marco/records",
            hint: "Every health record, by day",
          },
        ]}
      />

      <BodyPotentialCard potential={potential} />

      {/*
        Descriptive, never prescriptive (build spec §9). This reports what
        was logged and how it moved; it never says what the user should do
        about it, and never interprets symptoms.
      */}
      <div className="mx-4 rounded-xl border border-border bg-background-elevated p-4">
        <p className="text-xs text-foreground-muted">This week</p>
        <p className="text-2xl font-semibold" style={{ color: "var(--color-marco)" }}>
          {report.sessions} session{report.sessions === 1 ? "" : "s"}
        </p>
        <p className="mt-1 text-sm text-foreground-muted">{describeTrend(report)}</p>
      </div>

      <CaptureList agent="marco" emptyLabel="Nothing logged yet. Try “did 45 minutes legs”." />

      <ChatInputBar variant="agent" placeholder="e.g. slept 7 hours" />
    </div>
  );
}
