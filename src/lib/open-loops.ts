// What is actually waiting on you, across every agent.
//
// Home used to show a greeting and an orb while an overdue task sat one
// tab away, and the banner zone spoke only for Tony. Open loops are the
// retention mechanic (build spec §11, Zeigarnik) and they do not belong to
// one agent, so this gathers them from all of them.
//
// Warnings only. A day with nothing owed renders as nothing at all, which
// is the point: the emptiness is the good news.
import { getNudgeStatus } from "./nudge-engine";
import { isStale } from "./finance";
import { isOverdue } from "./tasks";
import { STAGE_LABELS, type Account, type AgentId, type JobApplication, type Task } from "./types";

export type LoopSeverity = "overdue" | "soon";

export interface OpenLoop {
  id: string;
  agent: AgentId;
  severity: LoopSeverity;
  text: string;
  href: string;
  // How overdue, for ordering. Not shown.
  weight: number;
}

export interface LoopInput {
  applications: JobApplication[];
  tasks: Task[];
  accounts: Account[];
}

export function criticalLoops(
  { applications, tasks, accounts }: LoopInput,
  now: Date = new Date(),
): OpenLoop[] {
  const loops: OpenLoop[] = [];

  for (const app of applications) {
    if (app.lifecycleStatus !== "active") continue;
    const nudge = getNudgeStatus(app, now);
    if (nudge.severity === "none") continue;

    loops.push({
      id: app.id,
      agent: "tony",
      severity: nudge.severity === "overdue" ? "overdue" : "soon",
      text:
        nudge.severity === "overdue"
          ? `${app.company} — no reply for ${nudge.daysOverdue} day${nudge.daysOverdue === 1 ? "" : "s"}`
          : `${app.company} — ${STAGE_LABELS[app.stage]}, due soon`,
      href: `/tony/detail?id=${app.id}`,
      weight: nudge.daysOverdue,
    });
  }

  for (const task of tasks) {
    if (!isOverdue(task, now)) continue;
    const days = Math.floor(
      (now.getTime() - new Date(task.dueAt as string).getTime()) / 86400000,
    );
    loops.push({
      id: task.id,
      agent: "lisa",
      severity: "overdue",
      text: days >= 1 ? `${task.title} — ${days}d late` : `${task.title} — due`,
      href: "/lisa",
      weight: days,
    });
  }

  // A stale balance is not late, it is unknown - and an unknown balance is
  // what makes every figure downstream of it untrustworthy.
  for (const account of accounts) {
    if (!isStale(account, now)) continue;
    loops.push({
      id: account.id,
      agent: "vanessa",
      severity: "soon",
      text: `${account.name} — balance not checked this week`,
      href: "/vanessa",
      weight: 0,
    });
  }

  // Marco never appears here. He describes, he does not chase (spec §9).

  return loops.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "overdue" ? -1 : 1;
    return b.weight - a.weight;
  });
}
