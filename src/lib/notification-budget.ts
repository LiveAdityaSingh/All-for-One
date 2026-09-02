// Jarvis's notification budget (build spec §10). Agents bid for a fixed
// number of interruptions per day and the highest urgency wins; nothing
// else fires. Without this, each agent scheduling independently just
// recreates notification spam by another route.
import type { AgentId } from "./types";

export interface NotificationBid {
  agent: AgentId;
  // Higher wins. Scaled so a late-stage Tony nudge outranks a routine
  // Vanessa check-in, per the spec's own worked example.
  urgency: number;
  title: string;
  body: string;
  // Every cross-agent decision must be explainable to the user
  // (build spec §10), including why this agent got to interrupt.
  reason: string;
}

// One interruption a day by default. The spec's preferred shape is a
// single merged evening card rather than several separate pings.
export const DAILY_INTERRUPTION_BUDGET = 1;

// Marco has no interruption rights. Ever. (build spec §9) Enforced here
// rather than at each call site so it can't be forgotten later.
const SILENT_AGENTS: readonly AgentId[] = ["marco"];

export interface Allocation {
  winners: NotificationBid[];
  // Bids that lost, kept so the app can explain what it chose not to say.
  suppressed: NotificationBid[];
}

export function allocateNotifications(
  bids: NotificationBid[],
  budget: number = DAILY_INTERRUPTION_BUDGET,
): Allocation {
  const eligible = bids.filter((bid) => !SILENT_AGENTS.includes(bid.agent));
  const ranked = [...eligible].sort((a, b) => b.urgency - a.urgency);

  return {
    winners: ranked.slice(0, Math.max(0, budget)),
    suppressed: [
      ...ranked.slice(Math.max(0, budget)),
      ...bids.filter((bid) => SILENT_AGENTS.includes(bid.agent)),
    ],
  };
}

// Urgency for a Tony follow-up. Later stages score higher because the
// cost of not chasing rises as you get closer (build spec §6), and being
// overdue adds on top of that.
export function applicationUrgency(
  stage: string,
  daysOverdue: number,
): number {
  const stageWeight: Record<string, number> = {
    final_stage: 40,
    interviewed: 30,
    recruiter_screen: 20,
    applied: 10,
  };
  return (stageWeight[stage] ?? 0) + Math.min(daysOverdue, 20);
}

// Vanessa's routine balance prompt - deliberately low so it only ever
// wins on a day when Tony has nothing pressing.
export const VANESSA_ROUTINE_URGENCY = 5;
