// Marco reports what happened. He is descriptive, never prescriptive
// (build spec §9): he may say what was logged and how trends are moving,
// but must not tell the user what they should eat or do, and must not
// interpret symptoms. Crossing that line risks UK MHRA
// software-as-a-medical-device territory, so the wording produced here
// stays factual on purpose.
import type { Capture } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface HealthReport {
  sessions: number;
  totalMinutes: number;
  previousSessions: number;
  previousMinutes: number;
  byActivity: { activity: string; sessions: number; minutes: number }[];
  hasHistory: boolean;
}

function within(capture: Capture, from: number, to: number): boolean {
  const t = new Date(capture.capturedAt).getTime();
  return t >= from && t < to;
}

export function buildWeeklyReport(
  captures: Capture[],
  now: Date = new Date(),
): HealthReport {
  const workouts = captures.filter((c) => c.kind === "workout");
  const end = now.getTime();
  const weekStart = end - 7 * DAY_MS;
  const priorStart = end - 14 * DAY_MS;

  const thisWeek = workouts.filter((c) => within(c, weekStart, end));
  const lastWeek = workouts.filter((c) => within(c, priorStart, weekStart));

  const totals = new Map<string, { sessions: number; minutes: number }>();
  for (const workout of thisWeek) {
    const held = totals.get(workout.label) ?? { sessions: 0, minutes: 0 };
    held.sessions += 1;
    held.minutes += workout.durationMinutes ?? 0;
    totals.set(workout.label, held);
  }

  return {
    sessions: thisWeek.length,
    totalMinutes: thisWeek.reduce((sum, w) => sum + (w.durationMinutes ?? 0), 0),
    previousSessions: lastWeek.length,
    previousMinutes: lastWeek.reduce((sum, w) => sum + (w.durationMinutes ?? 0), 0),
    byActivity: [...totals.entries()]
      .map(([activity, v]) => ({ activity, ...v }))
      .sort((a, b) => b.sessions - a.sessions),
    hasHistory: lastWeek.length > 0,
  };
}

// Strictly a statement of what the numbers did. No recommendation, no
// judgement about whether it was enough.
export function describeTrend(report: HealthReport): string {
  if (report.sessions === 0 && !report.hasHistory) {
    return "Nothing logged in the last two weeks.";
  }
  if (!report.hasHistory) {
    return "First week with sessions logged, so there is nothing to compare against yet.";
  }

  const delta = report.sessions - report.previousSessions;
  if (delta === 0) return "Same number of sessions as the week before.";
  return delta > 0
    ? `${delta} more session${delta === 1 ? "" : "s"} than the week before.`
    : `${Math.abs(delta)} fewer session${Math.abs(delta) === 1 ? "" : "s"} than the week before.`;
}
