"use client";

import { useState } from "react";
import { useMoney } from "@/lib/use-money";
import type { Runway } from "@/lib/finance";

// The template's "Financial Pulse" slot. It reveals the actual runway and
// burn rather than a teaser: a mystery box that resolves to nothing is
// worth less than the one number this whole screen exists to produce.
export function PulseCard({ runway }: { runway: Runway }) {
  const { formatMoneyRounded } = useMoney();
  const [open, setOpen] = useState(false);

  const headline = (() => {
    switch (runway.state) {
      case "ok":
        return `${runway.months!.toFixed(1)} months of runway`;
      case "stale":
        return `About ${runway.months!.toFixed(1)} months, on stale balances`;
      case "growing":
        return "Balances are going up, not down";
      case "insufficient_history":
        return "Not enough history to work out your burn yet";
      default:
        return "Add an account to see your runway";
    }
  })();

  const detail = (() => {
    switch (runway.state) {
      case "ok":
        return `${formatMoneyRounded(runway.totalBalance)} across your accounts, going down about ${formatMoneyRounded(runway.monthlyBurn!)} a month over the last ${Math.round(runway.daysOfHistory)} days.`;
      case "stale":
        return `Based on ${runway.staleAccounts.join(", ")}, last updated over a week ago. Update to trust this number.`;
      case "growing":
        return `Your balances rose over the last ${Math.round(runway.daysOfHistory)} days, so there is no burn rate to divide by.`;
      case "insufficient_history":
        return "Update your balances over a week or so and this fills in on its own.";
      default:
        return "Add the accounts you actually use and give each one a purpose.";
    }
  })();

  // Trustworthy figures keep Vanessa's violet; anything resting on stale
  // or missing inputs drops to neutral grey (build spec §4).
  const trusted = runway.state === "ok" || runway.state === "growing";
  const accent = trusted ? "var(--color-vanessa)" : "var(--color-stale)";

  return (
    <button
      onClick={() => setOpen((v) => !v)}
      aria-expanded={open}
      // The card always glows, like every other agent's headline. The
      // trust signal survives in the colour of the light rather than in
      // its absence: violet when the figures can be relied on, drained
      // grey when they rest on stale inputs.
      data-tour="pulse"
      className="lip agent-glow mx-4 flex flex-col gap-2 rounded-2xl border p-4 text-left"
      style={{
        borderColor: trusted
          ? "color-mix(in oklch, var(--color-vanessa) 40%, transparent)"
          : "var(--border-stale)",
        backgroundColor: trusted
          ? "color-mix(in oklch, var(--color-vanessa) 9%, var(--background-elevated))"
          : "var(--background-stale)",
        ["--glow" as string]: accent,
      }}
    >
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
          style={{
            backgroundColor: "color-mix(in oklch, var(--color-vanessa) 22%, transparent)",
            boxShadow: trusted
              ? "0 0 18px -6px color-mix(in oklch, var(--color-vanessa) 80%, transparent)"
              : "none",
          }}
          aria-hidden
        >
          ✦
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium tracking-widest text-foreground-muted">
            FINANCIAL PULSE
          </p>
          <p className="text-sm font-semibold" style={{ color: accent }}>
            {headline}
          </p>
        </div>
        <span className="text-foreground-muted" aria-hidden>
          {open ? "▾" : "›"}
        </span>
      </div>

      {open && <p className="text-xs text-foreground-muted">{detail}</p>}
    </button>
  );
}
