"use client";

import { Flame, Rocket, Sparkle, Star, Zap } from "lucide-react";
import { currentStreak } from "@/lib/tasks";
import { daysToGraduate, graduationProgress, streakTier, type StreakIcon } from "@/lib/streaks";
import type { Task } from "@/lib/types";

const ICONS: Record<StreakIcon, typeof Flame> = {
  sparkle: Sparkle,
  flame: Flame,
  zap: Zap,
  star: Star,
  rocket: Rocket,
};

// Three across is the most a phone can hold and still leave each cell
// readable; a fourth habit wraps onto a second row rather than shrinking
// every cell to fit.
const MAX_COLUMNS = 3;

// Runs of days, in one card divided the way the income/expenses/net box
// is: one habit fills it, two split it in half, three into thirds.
//
// The score above says how much you got through. This says how long you
// have kept something up, which is the part worth being proud of. Nothing
// is shown at zero - a cold cell for a run you have not started reads as a
// reproach rather than an invitation.
export function HabitStreaks({ tasks }: { tasks: Task[] }) {
  const now = new Date();

  const runs = tasks
    .map((task) => ({ task, streak: currentStreak(task, now) }))
    .filter((r) => r.streak > 0)
    .sort((a, b) => b.streak - a.streak);

  if (runs.length === 0) return null;

  const columns = Math.min(runs.length, MAX_COLUMNS);

  return (
    <div
      className="lip mx-4 grid overflow-hidden rounded-2xl border border-border bg-background-elevated"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {runs.map(({ task, streak }, index) => {
        const tier = streakTier(streak);
        if (!tier) return null;
        const Icon = ICONS[tier.icon];
        const left = daysToGraduate(streak);

        return (
          <div
            key={task.id}
            className="flex flex-col items-center gap-1 px-2 py-3"
            style={{
              // Dividers drawn per cell rather than with divide-x, which
              // would put a stray line down the first cell of a wrapped row.
              borderLeft: index % columns === 0 ? undefined : "1px solid var(--border)",
              borderTop: index >= columns ? "1px solid var(--border)" : undefined,
            }}
          >
            <span className="w-full truncate text-center text-[10px] uppercase tracking-wider text-foreground-muted">
              {task.title}
            </span>

            <span className="flex items-center gap-1.5">
              <Icon
                size={18}
                strokeWidth={2.2}
                aria-hidden
                style={{
                  color: tier.colour,
                  filter: `drop-shadow(0 0 7px color-mix(in oklch, ${tier.colour} 75%, transparent))`,
                }}
              />
              <span
                className="text-xl font-semibold tabular-nums"
                style={{ color: tier.colour }}
              >
                {streak}
              </span>
            </span>

            <span className="text-[11px] text-foreground-muted">
              <span className="sr-only">{tier.label}. </span>
              {left > 0 ? `${left} to go` : "habit made"}
            </span>

            {/* Echoes the track under the score above: how close this run
                is to becoming an ordinary daily task. */}
            <span
              className="mt-0.5 h-1 w-10 overflow-hidden rounded-full"
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
    </div>
  );
}
