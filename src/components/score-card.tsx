"use client";

import type { AgentId } from "@/lib/types";
import type { AgentScore } from "@/lib/agent-scores";

// The lighter sibling of the Body Potential card: one number, what it was
// measured from, and a track showing it. Same rule about empty state - a
// score of null renders as a dash and an invitation, never as 0%.
export function ScoreCard({ agent, score }: { agent: AgentId; score: AgentScore }) {
  const empty = score.score === null;

  return (
    <div
      className="lip mx-4 flex items-center gap-4 rounded-2xl border p-4"
      style={{
        borderColor: `var(--color-${agent}-muted)`,
        backgroundColor: `color-mix(in oklch, var(--color-${agent}) 7%, var(--background-elevated))`,
      }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-foreground-muted">
          {score.label}
        </p>
        <p className="mt-1 text-xs text-foreground-muted">{score.detail}</p>

        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full"
          style={{ backgroundColor: "var(--border)" }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${score.score ?? 0}%`,
              backgroundColor: empty ? "var(--color-stale)" : `var(--color-${agent})`,
            }}
          />
        </div>
      </div>

      {/* Same reasoning as the Body Potential card: a lone dash at this
          size looks like a drawing mistake rather than an empty measure. */}
      <p
        className={`shrink-0 font-semibold tabular-nums ${empty ? "text-xs" : "text-3xl"}`}
        style={{ color: empty ? "var(--color-stale)" : `var(--color-${agent})` }}
      >
        {empty ? "no score yet" : `${score.score}%`}
      </p>
    </div>
  );
}
