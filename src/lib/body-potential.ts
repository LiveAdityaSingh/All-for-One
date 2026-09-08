// Marco's headline number.
//
// A single health percentage is the kind of figure people over-trust, and
// the spec deliberately made Marco descriptive rather than interpretive.
// So this is built to be honest about what it is: a measure of how
// consistently you did the three things you told the app about, never a
// judgement about your body. Every component reports its own input, the
// card shows the arithmetic, and a component with no data is excluded and
// said to be excluded rather than silently scored zero.
import type { BodyMetrics, Capture } from "./types";

export const WINDOW_DAYS = 7;

// Targets are the ordinary public-health ones rather than anything
// invented: roughly 150 minutes of activity a week, 7-9 hours a night.
export const WEEKLY_ACTIVE_MINUTES = 150;
export const SLEEP_TARGET_HOURS = 7.5;

export type ComponentKey = "movement" | "sleep" | "fuel";

export interface ScoreComponent {
  key: ComponentKey;
  label: string;
  // 0-100, or null when nothing was logged and the component is excluded.
  score: number | null;
  // What the number was actually computed from, shown under it.
  detail: string;
}

export interface BodyPotential {
  // null when nothing at all has been logged: no data is not zero.
  score: number | null;
  components: ScoreComponent[];
  counted: number;
  bmi: number | null;
  headline: string;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function withinWindow(captures: Capture[], now: Date): Capture[] {
  const cutoff = now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return captures.filter((c) => new Date(c.capturedAt).getTime() >= cutoff);
}

function dayKeys(captures: Capture[]): Set<string> {
  return new Set(captures.map((c) => c.capturedAt.slice(0, 10)));
}

export function bmiFrom(metrics: BodyMetrics | undefined): number | null {
  if (!metrics?.heightCm || !metrics.weightKg) return null;
  const metres = metrics.heightCm / 100;
  if (metres <= 0) return null;
  return Math.round((metrics.weightKg / (metres * metres)) * 10) / 10;
}

export function computeBodyPotential(
  captures: Capture[],
  metrics: BodyMetrics | undefined,
  now: Date = new Date(),
): BodyPotential {
  const recent = withinWindow(captures, now);

  // Movement: minutes done against the weekly guideline. A session with no
  // duration still counts as something, at a conservative 30 minutes.
  const workouts = recent.filter((c) => c.kind === "workout");
  const activeMinutes = workouts.reduce((sum, c) => sum + (c.durationMinutes ?? 30), 0);
  const movement: ScoreComponent = {
    key: "movement",
    label: "Movement",
    score: workouts.length === 0 ? null : clamp((activeMinutes / WEEKLY_ACTIVE_MINUTES) * 100),
    detail:
      workouts.length === 0
        ? "nothing logged this week"
        : `${activeMinutes} of ${WEEKLY_ACTIVE_MINUTES} minutes, ${workouts.length} session${
            workouts.length === 1 ? "" : "s"
          }`,
  };

  // Sleep: average of the nights actually recorded, against the target.
  // Averaging only recorded nights means a missed log does not read as a
  // sleepless night.
  const sleeps = recent.filter((c) => c.kind === "sleep" && c.durationMinutes);
  const avgHours =
    sleeps.length === 0
      ? 0
      : sleeps.reduce((sum, c) => sum + (c.durationMinutes ?? 0), 0) / sleeps.length / 60;
  const sleep: ScoreComponent = {
    key: "sleep",
    label: "Sleep",
    score: sleeps.length === 0 ? null : clamp((avgHours / SLEEP_TARGET_HOURS) * 100),
    detail:
      sleeps.length === 0
        ? "nothing logged this week"
        : `${avgHours.toFixed(1)}h average over ${sleeps.length} night${
            sleeps.length === 1 ? "" : "s"
          }`,
  };

  // Fuel is deliberately the weakest claim in here: without a food
  // database this counts days you recorded eating, not what you ate. The
  // label says so rather than implying nutrition was assessed.
  const meals = recent.filter((c) => c.kind === "meal");
  const daysLogged = dayKeys(meals).size;
  const fuel: ScoreComponent = {
    key: "fuel",
    label: "Fuel",
    score: meals.length === 0 ? null : clamp((daysLogged / WINDOW_DAYS) * 100),
    detail:
      meals.length === 0
        ? "nothing logged this week"
        : `meals recorded on ${daysLogged} of ${WINDOW_DAYS} days`,
  };

  const components = [movement, sleep, fuel];
  const scored = components.filter((c) => c.score !== null);
  const score =
    scored.length === 0
      ? null
      : Math.round(scored.reduce((sum, c) => sum + (c.score as number), 0) / scored.length);

  return {
    score,
    components,
    counted: scored.length,
    bmi: bmiFrom(metrics),
    headline:
      score === null
        ? "Log a workout, a night's sleep or a meal to start"
        : scored.length === 3
          ? "From movement, sleep and fuel"
          : `From ${scored.map((c) => c.label.toLowerCase()).join(" and ")} only`,
  };
}
