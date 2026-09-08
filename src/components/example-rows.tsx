"use client";

import type { AgentId } from "@/lib/types";

export interface ExampleRow {
  primary: string;
  secondary: string;
  // How you would actually create this one. Kept honest: only phrases the
  // on-device parser really handles are shown as things you can say.
  how: string;
  spoken?: boolean;
}

// Examples exist to answer "what is this screen for", so they are shown
// only while a screen is empty and they vanish the moment there is real
// data. Nothing here is ever written to the database - these are JSX, not
// records - so there is nothing to clean up afterwards and no chance of an
// example being mistaken for something the user logged.
export function ExampleRows({
  agent,
  intro,
  rows,
}: {
  agent: AgentId;
  intro: string;
  rows: ExampleRow[];
}) {
  return (
    <section className="flex flex-col gap-2 px-4" aria-label="Examples">
      <p className="text-sm text-foreground-muted">{intro}</p>

      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li
            key={row.primary}
            // Dashed, drained and labelled: three separate signals that
            // this is not one of your records.
            className="flex flex-col gap-1.5 rounded-xl border border-dashed p-3"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--background-stale)" }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm" style={{ color: "var(--color-stale)" }}>
                {row.primary}
              </span>
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider"
                style={{ border: "1px solid var(--border)", color: "var(--color-stale)" }}
              >
                Example
              </span>
            </div>

            <span className="text-xs" style={{ color: "var(--color-stale)" }}>
              {row.secondary}
            </span>

            <span className="text-xs text-foreground-muted">
              {row.spoken ? (
                <>
                  Say{" "}
                  <span style={{ color: `var(--color-${agent})` }}>
                    &ldquo;{row.how}&rdquo;
                  </span>
                </>
              ) : (
                row.how
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
