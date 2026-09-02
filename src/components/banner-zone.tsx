"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { AppLink } from "@/components/app-link";
import { buildDailyDigest, type NudgeStatus } from "@/lib/nudge-engine";
import { STAGE_LABELS } from "@/lib/types";

const VISIBLE_CAP = 3;

function bannerCopy(status: NudgeStatus): string {
  const { application, daysOverdue } = status;
  const label = `${application.company} - ${STAGE_LABELS[application.stage]}`;
  if (status.severity === "overdue") {
    return `${label}: overdue by ${daysOverdue} day${daysOverdue === 1 ? "" : "s"}`;
  }
  return `${label}: due soon`;
}

// Warnings only (build spec §5). A good day renders as an empty screen -
// that emptiness is intentional, so this component renders nothing rather
// than an empty-state message when there's nothing to flag.
export function BannerZone() {
  const digest = useLiveQuery(() => buildDailyDigest(), []);

  if (!digest || digest.length === 0) return null;

  const visible = digest.slice(0, VISIBLE_CAP);
  const overflow = digest.length - visible.length;

  return (
    <div className="flex flex-col gap-2 px-4">
      {visible.map((status) => (
        <AppLink
          key={status.application.id}
          href={`/tony/detail?id=${status.application.id}`}
          className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
          style={{
            borderColor: "var(--color-tony-muted)",
            backgroundColor: "color-mix(in oklch, var(--color-tony) 12%, transparent)",
          }}
        >
          {status.severity === "overdue" && (
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: "var(--color-overdue)" }}
            />
          )}
          <span className="text-foreground">{bannerCopy(status)}</span>
        </AppLink>
      ))}
      {overflow > 0 && (
        <span className="px-1 text-xs text-foreground-muted">+{overflow} more</span>
      )}
    </div>
  );
}
