"use client";

// Four weekly buckets of one measure.
//
// One series, so there is no legend: the heading names it. Values are
// labelled selectively rather than on every bar - the newest week, and the
// best one when that is a different bar - because a number over every mark
// is noise, not information. Text takes text tokens; only the marks carry
// the agent's colour.
const BAR_RADIUS = 4;
// Thin marks: the bar occupies a little over half its slot, so the row
// reads as a set of measurements rather than a wall of blocks.
const BAR_FRACTION = 0.55;

// A bar anchored to the baseline: rounded at the data end, square where it
// meets the axis.
function barPath(x: number, y: number, width: number, height: number): string {
  const r = Math.min(BAR_RADIUS, width / 2, height);
  if (height <= 0) return "";
  return [
    `M ${x} ${y + height}`,
    `L ${x} ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    `L ${x + width - r} ${y}`,
    `Q ${x + width} ${y} ${x + width} ${y + r}`,
    `L ${x + width} ${y + height}`,
    "Z",
  ].join(" ");
}

export interface WeekBar {
  // Axis label. Every bar gets one of the same kind.
  label: string;
  value: number;
  // What a reader should see, e.g. "45 min" rather than "45".
  display: string;
}

export function WeekBars({
  bars,
  colour,
  unitLabel,
}: {
  bars: WeekBar[];
  colour: string;
  unitLabel: string;
}) {
  const width = 100;
  const height = 34;
  const slot = width / bars.length;
  const barWidth = slot * BAR_FRACTION;
  const peak = Math.max(...bars.map((b) => b.value), 0);

  // Newest first in the data; drawn oldest-first so time runs left to right.
  const ordered = [...bars].reverse();
  const newestIndex = ordered.length - 1;

  return (
    <div className="flex flex-col gap-1">
      <svg
        viewBox={`0 0 ${width} ${height + 2}`}
        className="w-full overflow-visible"
        role="img"
        aria-label={`${unitLabel} by week: ${ordered.map((b) => `${b.label} ${b.display}`).join(", ")}`}
      >
        {ordered.map((bar, i) => {
          const x = i * slot + (slot - barWidth) / 2;
          const full = peak === 0 ? 0 : (bar.value / peak) * height;
          const y = height - full;

          return (
            <g key={bar.label}>
              {/* The track is always drawn, so a week with nothing logged
                  reads as an empty measure rather than a missing bar. */}
              <path d={barPath(x, height - 2, barWidth, 2)} fill="var(--border)" />
              {full > 0 && <path d={barPath(x, y, barWidth, full)} fill={colour} />}
              <title>
                {bar.label}: {bar.display}
              </title>
            </g>
          );
        })}

        {/* Recessive baseline rather than a full grid. */}
        <line
          x1="0"
          y1={height + 0.5}
          x2={width}
          y2={height + 0.5}
          stroke="var(--border)"
          strokeWidth="1"
        />
      </svg>

      <div className="flex">
        {ordered.map((bar, i) => (
          <span
            key={bar.label}
            className="min-w-0 flex-1 px-0.5 text-center text-[9px] text-foreground-muted"
          >
            <span className="block truncate">{bar.label}</span>
            {/* One direct label, on the newest week, placed below the axis
                rather than over the mark - inside the plot it collided with
                the tallest bar, which is the one it describes. */}
            {i === newestIndex && bar.value > 0 && (
              <span className="block truncate font-medium text-foreground">{bar.display}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
