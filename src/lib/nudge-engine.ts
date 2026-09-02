// Lisa's nudge scheduler, built in phase 0 as Tony's follow-up engine
// (build spec §7) - shared component, not agent-specific yet.

import { differenceInCalendarDays } from "date-fns";
import { db } from "./db";
import { DEFAULT_STAGE_TIMERS_DAYS, type JobApplication } from "./types";

export type NudgeSeverity = "overdue" | "approaching" | "none";

export interface NudgeStatus {
  application: JobApplication;
  daysInStage: number;
  timerDays: number | null;
  daysOverdue: number; // 0 if not overdue
  severity: NudgeSeverity;
}

// "Approaching" starts inside the last 20% of the stage timer.
const APPROACHING_WINDOW_RATIO = 0.2;

export function getNudgeStatus(
  application: JobApplication,
  today: Date = new Date(),
): NudgeStatus {
  const timerDays = DEFAULT_STAGE_TIMERS_DAYS[application.stage];
  const daysInStage = differenceInCalendarDays(
    today,
    new Date(application.stageEnteredAt),
  );

  if (timerDays === null || application.lifecycleStatus === "presumed_closed") {
    return { application, daysInStage, timerDays, daysOverdue: 0, severity: "none" };
  }

  const daysOverdue = Math.max(0, daysInStage - timerDays);
  const approachingFrom = timerDays - Math.ceil(timerDays * APPROACHING_WINDOW_RATIO);

  let severity: NudgeSeverity = "none";
  if (daysOverdue > 0) severity = "overdue";
  else if (daysInStage >= approachingFrom) severity = "approaching";

  return { application, daysInStage, timerDays, daysOverdue, severity };
}

// Ghosting decay (build spec §6): a nudge that's dismissed or ignored twice
// drops the application a stage on its own. Always reversible in one tap.
export function shouldDecay(application: JobApplication): boolean {
  return application.nudgesIgnored >= 2 && application.lifecycleStatus === "active";
}

export function applyDecay(application: JobApplication): JobApplication {
  const nextStatus = application.lifecycleStatus === "active" ? "stale" : "presumed_closed";
  return {
    ...application,
    lifecycleStatus: nextStatus,
    nudgesIgnored: 0,
  };
}

export async function recordNudgeIgnored(applicationId: string): Promise<void> {
  const app = await db.applications.get(applicationId);
  if (!app) return;

  const updated: JobApplication = {
    ...app,
    nudgesIgnored: app.nudgesIgnored + 1,
    lastNudgedAt: new Date().toISOString(),
  };

  await db.applications.put(shouldDecay(updated) ? applyDecay(updated) : updated);
}

// One tap, fully reversible: back to active, decay counter cleared.
export async function undoDecay(applicationId: string): Promise<void> {
  const app = await db.applications.get(applicationId);
  if (!app) return;
  await db.applications.put({ ...app, lifecycleStatus: "active", nudgesIgnored: 0 });
}

// The digest: one batched card, not one notification per job (build spec §6).
export async function buildDailyDigest(today: Date = new Date()): Promise<NudgeStatus[]> {
  const apps = await db.applications
    .where("lifecycleStatus")
    .anyOf(["active", "stale"])
    .toArray();

  return apps
    .map((app) => getNudgeStatus(app, today))
    .filter((status) => status.severity !== "none")
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
}
