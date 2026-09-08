// One headline number per agent, built the same way Body Potential is:
// each score reports what it was computed from, and returns null rather
// than zero when there is nothing to judge. A confident 0% on an empty
// app is a lie about the user, not a fact about their data.
import { isDoneForNow, isOverdue } from "./tasks";
import { getNudgeStatus } from "./nudge-engine";
import type { JobApplication, Task } from "./types";

export interface AgentScore {
  score: number | null;
  label: string;
  detail: string;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

// Tony: how much of the pipeline is actually alive. Not "how many jobs
// have you applied for" - volume is not progress - but what share of what
// you are tracking is still moving rather than ghosting or dead.
export function pipelineHealth(applications: JobApplication[]): AgentScore {
  const live = applications.filter(
    (a) => a.lifecycleStatus === "active" && a.stage !== "rejected" && a.stage !== "withdrawn",
  );

  if (applications.length === 0) {
    return {
      score: null,
      label: "Pipeline",
      detail: "Log an application to start",
    };
  }

  const overdue = live.filter((a) => getNudgeStatus(a).severity === "overdue").length;
  const chasing = live.length;

  // Every live application is worth a full share; one that has gone
  // overdue is worth half, because it is still yours but no longer moving.
  const raw = chasing === 0 ? 0 : ((chasing - overdue * 0.5) / chasing) * 100;

  return {
    score: clamp(raw),
    label: "Pipeline",
    detail:
      chasing === 0
        ? `nothing live of ${applications.length} tracked`
        : `${chasing} live, ${overdue} waiting on a reply`,
  };
}

// Lisa: did the things you said you would. Over the last week, the share
// of dated tasks that were finished rather than left to go overdue.
export function followThrough(tasks: Task[], now: Date = new Date()): AgentScore {
  if (tasks.length === 0) {
    return { score: null, label: "Follow-through", detail: "Add a task to start" };
  }

  const done = tasks.filter((t) => isDoneForNow(t, now)).length;
  const overdue = tasks.filter((t) => isOverdue(t, now)).length;
  const open = tasks.length - done;

  return {
    score: clamp((done / tasks.length) * 100),
    label: "Follow-through",
    detail:
      overdue > 0
        ? `${done} done, ${open} open, ${overdue} overdue`
        : `${done} done, ${open} open`,
  };
}
