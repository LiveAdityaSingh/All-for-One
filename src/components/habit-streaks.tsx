"use client";

import { Flame, Rocket, Sparkle, Star, Zap } from "lucide-react";
import { currentStreak, STREAK_TO_GRADUATE } from "@/lib/tasks";
import { daysToGraduate, graduationProgress, streakTier, type StreakIcon } from "@/lib/streaks";
import type { Task } from "@/lib/types";

const ICONS: Record<StreakIcon, typeof Flame> = {
  sparkle: Sparkle,
  flame: Flame,
  zap: Zap,
  star: Star,
  rocket: Rocket,
};

// Runs of days, shown under the score for their own sake.
//
// The score says how much you got through; this says how long you have
// kept something up, which is the part worth being proud of. Nothing is
// shown at zero: a cold badge for a run you have not started reads as a
// reproach rather than an invitation.
export function HabitStreaks({ tasks }: { tasks: Task[] }) {
  const now = new Date();

  const runs = tasks
    .map((task) => ({ task, streak: currentStreak(task, now) }))
    .filter((r) => r.streak > 0)
    .sort((a, b) => b.streak - a.streak);

  if (runs.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-4">
      {runs.map(({ task, streak }) => {
        const tier = streakTier(streak);
        if (!tier) return null;
        const Icon = ICONS[tier.icon];
        const left = daysToGraduate(streak);

        return (
          <div
            key={task.id}
            className="lip flex min-w-0 items-center gap-2 rounded-full border py-1.5 pl-2.5 pr-3"
            style={{
              borderColor: `color-mix(in oklch, ${tier.colour} 45%, transparent)`,
              backgroundColor: `color-mix(in oklch, ${tier.colour} 12%, var(--background-elevated))`,
            }}
          >
            <Icon
              size={16}
              strokeWidth={2.2}
              aria-hidden
              style={{
                color: tier.colour,
                filter: `drop-shadow(0 0 6px color-mix(in oklch, ${tier.colour} 70%, transparent))`,
              }}
            />

            <span
              className="text-sm font-semibold tabular-nums"
              style={{ color: tier.colour }}
            >
              {streak}
            </span>

            {/* Only the title truncates. The countdown sat inside it and
                was the first thing clipped on a narrow chip, which is
                exactly the part worth keeping. */}
            <span className="min-w-0 max-w-[9rem] truncate text-xs text-foreground-muted">
              {task.title}
            </span>
            <span className="sr-only">{tier.label}. </span>

            {/* A run with an end in sight is easier to keep than an
                open-ended one, so the remaining days are always shown. */}
            {left > 0 && (
              <span className="shrink-0 text-xs text-foreground-muted opacity-70">
                {left} to go
              </span>
            )}

            <span
              className="h-1 w-8 shrink-0 overflow-hidden rounded-full"
              style={{ backgroundColor: "var(--border)" }}
              aria-hidden
            >
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${graduationProgress(streak) * 100}%`,
                  backgroundColor: tier.colour,
                }}
              />
            </span>
          </div>
        );
      })}

      <p className="sr-only">
        A habit kept for {STREAK_TO_GRADUATE} days becomes an ordinary daily task.
      </p>
    </div>
  );
}
