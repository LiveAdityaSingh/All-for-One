"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { AppLink } from "@/components/app-link";
import { db } from "@/lib/db";
import { criticalLoops } from "@/lib/open-loops";

const VISIBLE_CAP = 4;

// Warnings only (build spec §5). A good day renders as an empty screen -
// that emptiness is intentional, so this renders nothing rather than an
// empty-state message when there is nothing to flag.
//
// It used to speak only for Tony, which meant Home could look calm while
// an overdue task sat one tab away. It now gathers from every agent that
// chases, each row tinted by whoever it belongs to.
export function BannerZone() {
  const applications = useLiveQuery(() => db.applications.toArray(), []);
  const tasks = useLiveQuery(() => db.tasks.toArray(), []);
  const accounts = useLiveQuery(() => db.accounts.toArray(), []);

  const loops = criticalLoops({
    applications: applications ?? [],
    tasks: tasks ?? [],
    accounts: accounts ?? [],
  });

  if (loops.length === 0) return null;

  const visible = loops.slice(0, VISIBLE_CAP);
  const overflow = loops.length - visible.length;

  return (
    <div data-tour="loops" className="flex flex-col gap-2 px-4">
      <p className="text-xs uppercase tracking-wider text-foreground-muted">Waiting on you</p>

      {visible.map((loop) => (
        <AppLink
          key={`${loop.agent}-${loop.id}`}
          href={loop.href}
          className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
          style={{
            borderColor: `var(--color-${loop.agent}-muted)`,
            backgroundColor: `color-mix(in oklch, var(--color-${loop.agent}) 12%, transparent)`,
          }}
        >
          {/* Severity is structural, never identity-coloured: the row is
              tinted by its agent, the dot says how urgent it is. */}
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{
              backgroundColor:
                loop.severity === "overdue" ? "var(--color-overdue)" : "var(--color-stale)",
            }}
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate text-foreground">{loop.text}</span>
        </AppLink>
      ))}

      {overflow > 0 && (
        <span className="px-1 text-xs text-foreground-muted">+{overflow} more</span>
      )}
    </div>
  );
}
