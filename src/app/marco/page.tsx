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
          {
            label: "Last four weeks",
            href: "/marco/report",
            hint: "Movement, sleep and fuel, week by week",
          },
        ]}
      />

      <BodyPotentialCard potential={potential} trend={describeTrend(report)} />

      {/*
        The sessions card that used to sit here said the same thing as the
        Movement component behind the gauge - the same number, twice, one
        under the other. Its trend line was the only part the gauge could
        not express, so that moved into the card and the rest went.

        Descriptive, never prescriptive (build spec §9): this reports what
        was logged and how it moved, never what to do about it.
      */}
      <CaptureList agent="marco" emptyLabel="Nothing logged yet. Try “did 45 minutes legs”." />

      <ChatInputBar variant="agent" placeholder="e.g. slept 7 hours" />
    </div>
  );
}
