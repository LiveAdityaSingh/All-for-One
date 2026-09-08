"use client";

import { ScoreGauge } from "@/components/score-gauge";
import type { BodyPotential } from "@/lib/body-potential";

// Only the headline number is shown here. The breakdown it was computed
// from lives on the records page rather than being deleted, so the score
// stays interrogable without cluttering the screen it heads.
export function BodyPotentialCard({
  potential,
  trend,
}: {
  potential: BodyPotential;
  // Week-on-week movement, which the score itself cannot express: the
  // gauge says where you are, this says which way you are going.
  trend?: string;
}) {
  const { score, headline, bmi } = potential;

  return (
    <div
      className="lip agent-glow mx-4 flex flex-col gap-2 rounded-2xl border p-4"
      style={{
        borderColor: "var(--color-marco-muted)",
        backgroundColor: "color-mix(in oklch, var(--color-marco) 8%, var(--background-elevated))",
        ["--glow" as string]: "var(--color-marco)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] uppercase tracking-wider text-foreground-muted">
          Body Potential · this week
        </p>
        {bmi !== null && (
          <p className="text-[10px] uppercase tracking-wider text-foreground-muted">
            BMI <span className="text-sm font-semibold text-foreground">{bmi}</span>
          </p>
        )}
      </div>

      <ScoreGauge score={score} caption={headline} />

      {trend && <p className="text-xs text-foreground-muted">{trend}</p>}

      <p className="text-[11px] text-foreground-muted">
        How consistently you logged movement, sleep and meals against ordinary
        weekly guidelines. Not a medical assessment.
      </p>
    </div>
  );
}
