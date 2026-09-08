"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { AgentHeader } from "@/components/agent-header";
import { AppLink } from "@/components/app-link";
import { ChatInputBar } from "@/components/chat-input-bar";
import { ScoreCard } from "@/components/score-card";
import { pipelineHealth } from "@/lib/agent-scores";
import { db } from "@/lib/db";
import { getNudgeStatus, recordNudgeIgnored, undoDecay } from "@/lib/nudge-engine";
import { STAGE_LABELS, type ApplicationStage, type JobApplication } from "@/lib/types";

const STAGE_ORDER: ApplicationStage[] = [
  "applied",
  "recruiter_screen",
  "interviewed",
  "final_stage",
  "offer",
  "rejected",
  "withdrawn",
];

async function advanceStage(app: JobApplication) {
  const currentIndex = STAGE_ORDER.indexOf(app.stage);
  const nextStage = STAGE_ORDER[Math.min(currentIndex + 1, STAGE_ORDER.length - 1)];
  await db.applications.put({
    ...app,
    stage: nextStage,
    stageEnteredAt: new Date().toISOString(),
    nudgesIgnored: 0,
    lifecycleStatus: "active",
  });
}

function ApplicationRow({ app }: { app: JobApplication }) {
  const nudge = getNudgeStatus(app);
  const isDecayed = app.lifecycleStatus !== "active";

  return (
    <li className="lip flex flex-col gap-2 rounded-xl border border-border bg-background-elevated p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">{app.company}</p>
          <p className="text-xs text-foreground-muted">{app.role}</p>
        </div>
        <span
          className="rounded-full px-2 py-1 text-xs font-medium"
          style={{
            backgroundColor: isDecayed ? "var(--color-stale)" : "var(--color-tony-muted)",
            color: "var(--background)",
          }}
        >
          {isDecayed
            ? app.lifecycleStatus === "stale"
              ? "Any news on this?"
              : "Presumed closed"
            : STAGE_LABELS[app.stage]}
        </span>
      </div>

      {nudge.severity === "overdue" && !isDecayed && (
        <p className="text-xs" style={{ color: "var(--color-overdue)" }}>
          Overdue by {nudge.daysOverdue} day{nudge.daysOverdue === 1 ? "" : "s"}
        </p>
      )}

      <div className="flex gap-2">
        {isDecayed ? (
          <button
            onClick={() => undoDecay(app.id)}
            className="rounded-full border border-border px-3 py-1 text-xs"
          >
            Undo
          </button>
        ) : (
          <>
            <button
              onClick={() => advanceStage(app)}
              className="rounded-full px-3 py-1 text-xs font-medium"
              style={{ backgroundColor: "var(--color-tony)", color: "var(--background)" }}
            >
              Advance
            </button>
            <button
              onClick={() => recordNudgeIgnored(app.id)}
              className="rounded-full border border-border px-3 py-1 text-xs"
            >
              No news yet
            </button>
          </>
        )}
        <AppLink href={`/tony/detail?id=${app.id}`} className="ml-auto text-xs text-foreground-muted underline">
          Tailor CV
        </AppLink>
      </div>
    </li>
  );
}

export default function TonyPage() {
  const applications = useLiveQuery(
    () => db.applications.orderBy("stageEnteredAt").reverse().toArray(),
    [],
  );

  return (
    <div className="flex flex-col gap-4">
      <AgentHeader
        agent="tony"
        subtitle="Applications and the CVs behind them"
        items={[
          { label: "Log an application", href: "/tony/new", hint: "Company, role, CV used" },
          { label: "Everything tracked", href: "/tony/records", hint: "Including closed and rejected" },
          { label: "Import from CSV", href: "/tony/import", hint: "Bring in a spreadsheet" },
          { label: "Claims", href: "/tony/claims", hint: "Facts your CV may draw on" },
          { label: "CV variants", href: "/tony/cv-variants", hint: "Which version went where" },
        ]}
      />

      <ScoreCard agent="tony" score={pipelineHealth(applications ?? [])} />

      <ul className="flex flex-col gap-3 px-4">
        {applications?.length === 0 && (
          <p className="text-sm text-foreground-muted">No applications yet.</p>
        )}
        {applications?.map((app) => <ApplicationRow key={app.id} app={app} />)}
      </ul>

      <ChatInputBar variant="agent" placeholder="e.g. applied to Acme for Data Scientist" />
    </div>
  );
}
