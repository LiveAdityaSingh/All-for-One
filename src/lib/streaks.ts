// How a run of days is shown.
//
// The point is motivation, so the marker escalates: a spark for the first
// couple of days, fire once it is a real run, and something unmistakable
// as three weeks approaches. The colour warms with it, using semantic heat
// rather than Lisa's blue - a streak is an achievement, not an identity.
import { STREAK_TO_GRADUATE } from "./tasks";

export type StreakIcon = "sparkle" | "flame" | "zap" | "star" | "rocket";

export interface StreakTier {
  icon: StreakIcon;
  colour: string;
  // Announced to screen readers, which get nothing from an icon.
  label: string;
}

const TIERS: { from: number; tier: StreakTier }[] = [
  { from: STREAK_TO_GRADUATE, tier: { icon: "rocket", colour: "oklch(0.68 0.19 30)", label: "three weeks" } },
  { from: 14, tier: { icon: "star", colour: "oklch(0.70 0.18 45)", label: "two weeks" } },
  { from: 7, tier: { icon: "zap", colour: "oklch(0.74 0.17 65)", label: "a week" } },
  { from: 3, tier: { icon: "flame", colour: "oklch(0.76 0.16 80)", label: "on a run" } },
  { from: 1, tier: { icon: "sparkle", colour: "oklch(0.72 0.10 95)", label: "started" } },
];

// Null below one day: a streak of nothing is not an achievement, and
// showing a cold badge for it would be discouraging rather than motivating.
export function streakTier(streak: number): StreakTier | null {
  if (streak < 1) return null;
  return TIERS.find(({ from }) => streak >= from)?.tier ?? null;
}

// How close this run is to becoming an ordinary daily task, 0-1, for the
// small progress line under the count.
export function graduationProgress(streak: number): number {
  return Math.max(0, Math.min(1, streak / STREAK_TO_GRADUATE));
}

export function daysToGraduate(streak: number): number {
  return Math.max(0, STREAK_TO_GRADUATE - streak);
}
