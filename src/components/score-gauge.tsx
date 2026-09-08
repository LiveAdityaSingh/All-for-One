"use client";

// A semicircular dial for a 0-100 score.
//
// The sweep is red through amber to green. That is semantic colour rather
// than identity colour - the same separation the overdue red already
// relies on - so it does not fight the agent hue that owns the screen.
//
// An unscored dial is deliberately not red: nothing logged is not a bad
// result, it is an absent one, so the track stays empty and neutral.
const RADIUS = 80;
const CENTRE_X = 100;
const CENTRE_Y = 100;
const ARC_LENGTH = Math.PI * RADIUS;

function pointAt(score: number): { x: number; y: number } {
  // 0 sits at the left end of the sweep, 100 at the right.
  const radians = Math.PI * (1 - score / 100);
  return {
    x: CENTRE_X + RADIUS * Math.cos(radians),
    y: CENTRE_Y - RADIUS * Math.sin(radians),
  };
}

export function ScoreGauge({
  score,
  caption,
}: {
  score: number | null;
  caption: string;
}) {
  const empty = score === null;
  const value = score ?? 0;
  const marker = pointAt(value);

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 200 118"
        className="w-full max-w-[280px]"
        role="img"
        aria-label={empty ? "No score yet" : `Body Potential ${value} out of 100`}
      >
        <defs>
          <linearGradient id="gauge-sweep" x1="20" y1="0" x2="180" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="oklch(0.62 0.19 25)" />
            <stop offset="50%" stopColor="oklch(0.75 0.16 85)" />
            <stop offset="100%" stopColor="oklch(0.72 0.16 155)" />
          </linearGradient>
        </defs>

        {/* The full sweep, always drawn, so the dial reads as a measure
            with a range rather than as a floating arc. */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="var(--border)"
          strokeWidth={12}
          strokeLinecap="round"
        />

        {!empty && (
          <>
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="url(#gauge-sweep)"
              strokeWidth={12}
              strokeLinecap="round"
              strokeDasharray={`${(ARC_LENGTH * value) / 100} ${ARC_LENGTH}`}
            />
            {/* The needle head: what makes it read as a dial rather than a
                progress bar bent into a curve. */}
            <circle
              cx={marker.x}
              cy={marker.y}
              r={7}
              fill="var(--background)"
              stroke="url(#gauge-sweep)"
              strokeWidth={4}
            />
          </>
        )}

        <text x="20" y="116" textAnchor="middle" fontSize="10" fill="var(--foreground-muted)">
          0
        </text>
        <text x="180" y="116" textAnchor="middle" fontSize="10" fill="var(--foreground-muted)">
          100
        </text>

        {empty ? (
          <text x="100" y="92" textAnchor="middle" fontSize="15" fill="var(--color-stale)">
            Nothing logged yet
          </text>
        ) : (
          <text
            x="100"
            y="92"
            textAnchor="middle"
            fontSize="42"
            fontWeight="600"
            fill="var(--foreground)"
          >
            {value}
          </text>
        )}
      </svg>

      <p className="-mt-1 text-center text-xs text-foreground-muted">{caption}</p>
    </div>
  );
}
