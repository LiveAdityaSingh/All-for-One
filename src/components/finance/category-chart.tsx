"use client";

import type { CategorySlice } from "@/lib/money";
import { useMoney } from "@/lib/use-money";

// Categorical colours for the breakdown. These are chart data colours,
// not agent identity - they stay off the five reserved agent hues so a
// slice can never be misread as "this belongs to Tony".
const SLICE_HUES = [285, 200, 45, 330, 170, 15, 260, 100];

function sliceColor(index: number, dim = false): string {
  const hue = SLICE_HUES[index % SLICE_HUES.length];
  return `oklch(0.62 ${dim ? 0.05 : 0.13} ${hue})`;
}

export function CategoryChart({ slices }: { slices: CategorySlice[] }) {
  const { formatMoney } = useMoney();
  if (slices.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none"
          stroke="var(--color-stale)" strokeWidth={1.5} aria-hidden>
          <path d="M12 3a9 9 0 1 0 9 9h-9V3z" />
        </svg>
        <p className="text-sm text-foreground-muted">No expenses in this period</p>
      </div>
    );
  }

  // A conic gradient draws the ring without pulling in a chart library
  // for what is ultimately a list of percentages.
  const stops = slices.reduce<{ start: number; parts: string[] }>(
    (acc, slice, i) => {
      const end = acc.start + slice.share;
      acc.parts.push(`${sliceColor(i)} ${acc.start * 100}% ${end * 100}%`);
      return { start: end, parts: acc.parts };
    },
    { start: 0, parts: [] },
  ).parts;

  return (
    <div className="flex items-center gap-4">
      <div
        className="h-24 w-24 shrink-0 rounded-full"
        style={{
          background: `conic-gradient(${stops.join(", ")})`,
          // Punched out to a ring so the shape reads as a chart, not a pie
          // of confusingly similar wedges.
          mask: "radial-gradient(circle, transparent 52%, black 53%)",
          WebkitMask: "radial-gradient(circle, transparent 52%, black 53%)",
        }}
        role="img"
        aria-label={slices.map((s) => `${s.category} ${Math.round(s.share * 100)}%`).join(", ")}
      />

      <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
        {slices.slice(0, 5).map((slice, i) => (
          <li key={slice.category} className="flex items-center gap-2 text-xs">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: sliceColor(i) }}
            />
            <span className="min-w-0 flex-1 truncate">{slice.category}</span>
            <span className="text-foreground-muted">
              {formatMoney(slice.amount)}
            </span>
            <span className="w-9 text-right text-foreground-muted">
              {Math.round(slice.share * 100)}%
            </span>
          </li>
        ))}
        {slices.length > 5 && (
          <li className="text-xs text-foreground-muted">
            +{slices.length - 5} more
          </li>
        )}
      </ul>
    </div>
  );
}
