// Marco's thirty-day look back.
//
// Descriptive, never prescriptive (build spec §9). Every figure here is a
// count of what you logged; none of it says whether that was enough, and
// none of it interprets how you felt. Where nothing was logged it says so
// rather than reporting a zero, because an unlogged week and a week off
// are different things and only you know which it was.
import type { Capture } from "./types";

export const REPORT_DAYS = 28; // four whole weeks, so the buckets are equal

export interface WeekBucket {
  // Prose form, for a sentence: "this week", "last week", "3 weeks ago".
  label: string;
  // Axis form: the week's start date. Every bar gets the same kind of
  // label, so the axis cannot end up mixing words, dates and values.
  shortLabel: string;
  sessions: number;
  minutes: number;
  nights: number;
  sleepHours: number | null;
  mealDays: number;
}

export interface MonthlyReport {
  from: Date;
  to: Date;
  movement: {
    sessions: number;
    minutes: number;
    topActivity: string | null;
    busiest: WeekBucket | null;
  };
  sleep: {
    nights: number;
    averageHours: number | null;
    shortest: number | null;
    longest: number | null;
  };
  fuel: { meals: number; daysLogged: number };
  weeks: WeekBucket[];
  // True when nothing at all was logged, so the page can say that once
  // rather than repeating "nothing" in every section.
  empty: boolean;
}

const DAY = 24 * 60 * 60 * 1000;

function weekLabel(index: number): string {
  if (index === 0) return "This week";
  if (index === 1) return "Last week";
  return `${index} weeks ago`;
}

function axisLabel(start: Date): string {
  return start.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function buildMonthlyReport(
  captures: Capture[],
  now: Date = new Date(),
): MonthlyReport {
  const to = now;
  const from = new Date(now.getTime() - REPORT_DAYS * DAY);

  const mine = captures.filter((c) => {
    const at = new Date(c.capturedAt).getTime();
    return Number.isFinite(at) && at >= from.getTime() && at <= to.getTime();
  });

  const workouts = mine.filter((c) => c.kind === "workout");
  const sleeps = mine.filter((c) => c.kind === "sleep" && c.durationMinutes);
  const meals = mine.filter((c) => c.kind === "meal");

  // Weeks run backwards from now, so "this week" is the last seven days
  // rather than a calendar week that might be one day old.
  const weeks: WeekBucket[] = [];
  for (let i = 0; i < REPORT_DAYS / 7; i++) {
    const end = new Date(now.getTime() - i * 7 * DAY);
    const start = new Date(end.getTime() - 7 * DAY);
    const inWeek = (c: Capture) => {
      const at = new Date(c.capturedAt).getTime();
      return at > start.getTime() && at <= end.getTime();
    };

    const weekSleeps = sleeps.filter(inWeek);
    const weekMeals = meals.filter(inWeek);
    const weekWorkouts = workouts.filter(inWeek);

    weeks.push({
      label: weekLabel(i),
      shortLabel: axisLabel(start),
      sessions: weekWorkouts.length,
      minutes: weekWorkouts.reduce((sum, c) => sum + (c.durationMinutes ?? 30), 0),
      nights: weekSleeps.length,
      sleepHours:
        weekSleeps.length === 0
          ? null
          : weekSleeps.reduce((sum, c) => sum + (c.durationMinutes ?? 0), 0) /
            weekSleeps.length /
            60,
      mealDays: new Set(weekMeals.map((c) => c.capturedAt.slice(0, 10))).size,
    });
  }

  const counts = new Map<string, number>();
  for (const workout of workouts) {
    const label = workout.label.trim();
    if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const topActivity =
    [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const sleepHours = sleeps.map((c) => (c.durationMinutes ?? 0) / 60);

  return {
    from,
    to,
    movement: {
      sessions: workouts.length,
      minutes: workouts.reduce((sum, c) => sum + (c.durationMinutes ?? 30), 0),
      topActivity,
      busiest:
        weeks.some((w) => w.sessions > 0)
          ? weeks.reduce((best, w) => (w.sessions > best.sessions ? w : best))
          : null,
    },
    sleep: {
      nights: sleeps.length,
      averageHours:
        sleepHours.length === 0
          ? null
          : sleepHours.reduce((a, b) => a + b, 0) / sleepHours.length,
      shortest: sleepHours.length === 0 ? null : Math.min(...sleepHours),
      longest: sleepHours.length === 0 ? null : Math.max(...sleepHours),
    },
    fuel: {
      meals: meals.length,
      daysLogged: new Set(meals.map((c) => c.capturedAt.slice(0, 10))).size,
    },
    weeks,
    empty: mine.length === 0,
  };
}
