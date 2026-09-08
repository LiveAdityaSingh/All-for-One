"use client";

import type { BodyPotential } from "@/lib/body-potential";

// The score is shown with its arithmetic visible: a bare percentage would
// be a black box, and a health number people cannot interrogate is one
// they will either over-trust or ignore.
export function BodyPotentialCard({ potential }: { potential: BodyPotential }) {
  const { score, components, headline, bmi } = potential;

  return (
    <div
      className="lip agent-glow mx-4 flex flex-col gap-4 rounded-2xl border p-4"
      style={{
        borderColor: "var(--color-marco-muted)",
        backgroundColor: "color-mix(in oklch, var(--color-marco) 8%, var(--background-elevated))",
        ["--glow" as string]: "var(--color-marco)",
      }}
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-foreground-muted">
            Body Potential · this week
          </p>
          {/* An em dash at 4xl reads as a horizontal rule, not as "no
              score", so the empty state says it in words instead. */}
          {score === null ? (
            <p className="text-lg font-semibold" style={{ color: "var(--color-stale)" }}>
              Nothing logged yet
            </p>
          ) : (
            <p
              className="text-4xl font-semibold leading-tight tabular-nums"
              style={{ color: "var(--color-marco)" }}
            >
              {score}%
            </p>
          )}
          <p className="mt-0.5 text-xs text-foreground-muted">{headline}</p>
        </div>
        {bmi !== null && (
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-foreground-muted">BMI</p>
            <p className="text-lg font-semibold">{bmi}</p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        {components.map((component) => (
          <div key={component.key} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium">{component.label}</span>
              <span
                className="text-xs tabular-nums"
                style={{
                  color:
                    component.score === null
                      ? "var(--color-stale)"
                      : "var(--color-marco)",
                }}
              >
                {component.score === null ? "not logged" : `${component.score}%`}
              </span>
            </div>

            {/* The track is always drawn, so an unlogged component reads as
                an empty measure rather than as a missing row. */}
            <div
              className="h-1.5 overflow-hidden rounded-full"
              style={{ backgroundColor: "var(--border)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${component.score ?? 0}%`,
                  backgroundColor:
                    component.score === null ? "var(--color-stale)" : "var(--color-marco)",
                }}
              />
            </div>

            <span className="text-[11px] text-foreground-muted">{component.detail}</span>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-foreground-muted">
        This measures how consistently you logged movement, sleep and meals against
        ordinary weekly guidelines. It is not a medical assessment, and it says
        nothing about how you feel.
      </p>
    </div>
  );
}
