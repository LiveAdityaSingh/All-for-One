// Jarvis's cross-agent reasoning (build spec §10). Everything here runs
// on data already on the device - no model call - which keeps answers
// instant, free and available offline.
//
// The hard rule: Jarvis must show a visible reason for every cross-agent
// query. If Vanessa's data reaches Tony, the user sees why. Every answer
// therefore carries the agents it drew on and what it took from each.
import { db } from "./db";
import { formatMoneyRounded } from "./locale";
import { computeRunway } from "./finance";
import { buildWeeklyReport, describeTrend } from "./health";
import { getNudgeStatus } from "./nudge-engine";
import { isDoneForNow } from "./tasks";
import type { QuestionTopic } from "./intent";
import { STAGE_LABELS, type AgentId } from "./types";

export interface AnswerSource {
  agent: AgentId;
  detail: string;
}

export interface Answer {
  text: string;
  sources: AnswerSource[];
}

const LATE_STAGES = new Set(["interviewed", "final_stage", "offer"]);

async function answerRunway(now: Date): Promise<Answer> {
  const [accounts, snapshots, applications] = await Promise.all([
    db.accounts.toArray(),
    db.balanceSnapshots.toArray(),
    db.applications.toArray(),
  ]);

  const runway = computeRunway(accounts, snapshots, now);
  const sources: AnswerSource[] = [
    { agent: "vanessa", detail: `${accounts.length} account${accounts.length === 1 ? "" : "s"}` },
  ];

  if (runway.state === "no_accounts") {
    return { text: "No accounts yet, so there is no runway to work out.", sources };
  }
  if (runway.state === "insufficient_history") {
    return {
      text: "Not enough balance history yet. Update your balances over a week or so and I can work out your burn rate.",
      sources,
    };
  }
  if (runway.state === "growing") {
    return { text: "Your balances went up over this period, so you are not burning down.", sources };
  }

  let text =
    runway.state === "stale"
      ? `About ${runway.months!.toFixed(1)} months, but that rests on stale balances (${runway.staleAccounts.join(", ")}).`
      : `${runway.months!.toFixed(1)} months at your current burn of ${formatMoneyRounded(runway.monthlyBurn!)} a month.`;

  // The cross-agent part: a runway figure means something different when
  // there are live late-stage applications, so Tony is consulted and named.
  const live = applications.filter(
    (a) => a.lifecycleStatus === "active" && LATE_STAGES.has(a.stage),
  );

  if (live.length > 0) {
    text += ` You have ${live.length} application${live.length === 1 ? "" : "s"} at ${
      live.length === 1 ? STAGE_LABELS[live[0].stage].toLowerCase() : "a late stage"
    }.`;
    sources.push({
      agent: "tony",
      detail: `${live.length} late-stage application${live.length === 1 ? "" : "s"}`,
    });
  }

  return { text, sources };
}

async function answerPipeline(now: Date): Promise<Answer> {
  const applications = await db.applications.toArray();
  const active = applications.filter((a) => a.lifecycleStatus === "active");
  const sources: AnswerSource[] = [
    { agent: "tony", detail: `${applications.length} application${applications.length === 1 ? "" : "s"} tracked` },
  ];

  if (applications.length === 0) {
    return { text: "Nothing tracked yet. Say “applied to Acme for Data Scientist” to start.", sources };
  }

  const byStage = new Map<string, number>();
  for (const app of active) {
    byStage.set(app.stage, (byStage.get(app.stage) ?? 0) + 1);
  }

  const waiting = active
    .map((a) => getNudgeStatus(a, now))
    .filter((s) => s.severity !== "none").length;

  const breakdown = [...byStage.entries()]
    .map(([stage, count]) => `${count} ${STAGE_LABELS[stage as keyof typeof STAGE_LABELS].toLowerCase()}`)
    .join(", ");

  // Tone: asking a question, not auditing failure (build spec §6).
  let text = active.length === 0
    ? "Nothing active right now."
    : `${active.length} active: ${breakdown}.`;

  if (waiting > 0) text += ` Any news on ${waiting} of them?`;

  return { text, sources };
}

async function answerOpenLoops(now: Date): Promise<Answer> {
  const [tasks, applications] = await Promise.all([
    db.tasks.toArray(),
    db.applications.toArray(),
  ]);

  const openTasks = tasks.filter((t) => !isDoneForNow(t, now));
  const waiting = applications
    .filter((a) => a.lifecycleStatus === "active")
    .map((a) => getNudgeStatus(a, now))
    .filter((s) => s.severity !== "none");

  const sources: AnswerSource[] = [
    { agent: "lisa", detail: `${openTasks.length} open task${openTasks.length === 1 ? "" : "s"}` },
    { agent: "tony", detail: `${waiting.length} awaiting a reply` },
  ];

  if (openTasks.length === 0 && waiting.length === 0) {
    return { text: "Nothing open. Nothing needs you right now.", sources };
  }

  const parts: string[] = [];
  if (openTasks.length > 0) {
    parts.push(`${openTasks.length} task${openTasks.length === 1 ? "" : "s"}`);
  }
  if (waiting.length > 0) {
    parts.push(`${waiting.length} application${waiting.length === 1 ? "" : "s"} you could chase`);
  }

  return { text: `${parts.join(" and ")}.`, sources };
}

async function answerHealth(now: Date): Promise<Answer> {
  const captures = await db.captures.toArray();
  const report = buildWeeklyReport(captures, now);

  const sources: AnswerSource[] = [
    { agent: "marco", detail: `${report.sessions} session${report.sessions === 1 ? "" : "s"} this week` },
  ];

  if (report.sessions === 0) {
    return { text: describeTrend(report), sources };
  }

  const activities = report.byActivity.map((a) => a.activity).join(", ");
  return {
    text:
      `${report.sessions} session${report.sessions === 1 ? "" : "s"}` +
      (report.totalMinutes > 0 ? `, ${report.totalMinutes} minutes` : "") +
      ` this week (${activities}). ${describeTrend(report)}`,
    sources,
  };
}

export async function answerQuestion(
  topic: QuestionTopic,
  now: Date = new Date(),
): Promise<Answer> {
  switch (topic) {
    case "runway":
      return answerRunway(now);
    case "pipeline":
      return answerPipeline(now);
    case "open_loops":
      return answerOpenLoops(now);
    case "health":
      return answerHealth(now);
  }
}
