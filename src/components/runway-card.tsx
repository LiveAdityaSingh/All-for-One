"use client";

import type { Runway } from "@/lib/finance";
import { useMoney } from "@/lib/use-money";

// The killer number (build spec §8): it needs no bank connection, it is
// the most emotionally loaded figure in a job seeker's life, and it is the
// bridge from the acquisition wedge to the retention layer.
export function RunwayCard({ runway }: { runway: Runway }) {
  const { formatMoneyRounded } = useMoney();
  // Staleness desaturates. Colour means "I know this"; grey means
  // "don't trust me here" (build spec §4).
  const trusted = runway.state === "ok" || runway.state === "growing";
  const accent = trusted ? "var(--color-vanessa)" : "var(--color-stale)";

  return (
    <div
      className="mx-4 flex flex-col gap-1 rounded-xl border p-4"
      style={{
        borderColor: trusted ? "var(--color-vanessa-muted)" : "var(--border)",
        backgroundColor: trusted
          ? "color-mix(in oklch, var(--color-vanessa) 10%, transparent)"
          : "var(--background-elevated)",
      }}
    >
      <p className="text-xs text-foreground-muted">Runway at current burn</p>

      {runway.state === "ok" || runway.state === "stale" ? (
        <p className="text-3xl font-semibold" style={{ color: accent }}>
          {runway.months!.toFixed(1)} months
        </p>
      ) : (
        <p className="text-xl font-semibold" style={{ color: accent }}>
          {runway.state === "no_accounts" && "Add an account"}
          {runway.state === "insufficient_history" && "Not enough history yet"}
          {runway.state === "growing" && "Not burning down"}
        </p>
      )}

      <p className="text-xs text-foreground-muted">
        {formatMoneyRounded(runway.totalBalance)} across all accounts
        {runway.monthlyBurn !== null && runway.monthlyBurn > 0 &&
          ` · ${formatMoneyRounded(runway.monthlyBurn)}/month burn`}
      </p>

      {/* Never a confident number over stale inputs (build spec §8). */}
      {runway.state === "stale" && (
        <p className="mt-1 text-xs" style={{ color: "var(--color-overdue)" }}>
          Based on stale balances ({runway.staleAccounts.join(", ")}). Update them to trust
          this number.
        </p>
      )}

      {runway.state === "insufficient_history" && (
        <p className="mt-1 text-xs text-foreground-muted">
          Update your balances for a week or so and Vanessa can work out your burn rate.
        </p>
      )}

      {runway.state === "growing" && (
        <p className="mt-1 text-xs text-foreground-muted">
          Your balances went up over the last {Math.round(runway.daysOfHistory)} days.
        </p>
      )}
    </div>
  );
}
