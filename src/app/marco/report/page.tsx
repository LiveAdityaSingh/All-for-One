"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { WeekBars } from "@/components/week-bars";
import { formatHours } from "@/components/capture-list";
import { buildMonthlyReport, REPORT_DAYS } from "@/lib/monthly-report";
import { useAgentName } from "@/lib/use-agent-names";

const MARCO = "var(--color-marco)";

function Section({
  title,
  headline,
  detail,
  children,
}: {
  title: string;
  headline: string;
  detail: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="lip flex flex-col gap-2 rounded-2xl border border-border bg-background-elevated p-4">
      <p className="text-[10px] uppercase tracking-wider text-foreground-muted">{title}</p>
      <p className="text-2xl font-semibold" style={{ color: MARCO }}>
        {headline}
      </p>
      <p className="text-xs text-foreground-muted">{detail}</p>
      {children}
    </section>
  );
}

export default function MonthlyReportPage() {
  const name = useAgentName("marco");
  const captures = useLiveQuery(
    () => db.captures.where("agent").equals("marco").toArray(),
    [],
  );

  const report = buildMonthlyReport(captures ?? []);
  const weeks = report.weeks;

  return (
    <div className="flex flex-col gap-4 px-4">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: MARCO }}>
          The last four weeks
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          {report.from.toLocaleDateString()} to {report.to.toLocaleDateString()}.
          Everything {name} recorded, counted. Nothing here says whether it was
          enough &mdash; only you know that.
        </p>
      </div>

      {report.empty ? (
        <p className="text-sm text-foreground-muted">
          Nothing logged in the last {REPORT_DAYS} days. Say something like
          &ldquo;did 45 minutes legs&rdquo;, &ldquo;slept 7 hours&rdquo; or
          &ldquo;ate chicken and rice&rdquo; and this fills in.
        </p>
      ) : (
        <>
          <Section
            title="Movement"
            headline={`${report.movement.sessions} session${report.movement.sessions === 1 ? "" : "s"}`}
            detail={
              report.movement.sessions === 0
                ? "Nothing logged in this period."
                : `${report.movement.minutes} minutes in total` +
                  (report.movement.topActivity ? ` · most often ${report.movement.topActivity}` : "") +
                  (report.movement.busiest ? ` · busiest ${report.movement.busiest.label.toLowerCase()}` : "")
            }
          >
            <WeekBars
              colour={MARCO}
              unitLabel="Active minutes"
              bars={weeks.map((w) => ({
                label: w.shortLabel,
                value: w.minutes,
                display: `${w.minutes} min`,
              }))}
            />
          </Section>

          <Section
            title="Sleep"
            headline={
              report.sleep.averageHours === null
                ? "Not logged"
                : `${report.sleep.averageHours.toFixed(1)}h a night`
            }
            detail={
              report.sleep.nights === 0
                ? "No nights recorded in this period."
                : `${report.sleep.nights} night${report.sleep.nights === 1 ? "" : "s"} recorded · ` +
                  `${(report.sleep.shortest ?? 0).toFixed(1)}h to ${(report.sleep.longest ?? 0).toFixed(1)}h`
            }
          >
            <WeekBars
              colour={MARCO}
              unitLabel="Average hours slept"
              bars={weeks.map((w) => ({
                label: w.shortLabel,
                value: w.sleepHours ?? 0,
                display: w.sleepHours === null ? "none" : formatHours(Math.round(w.sleepHours * 60)),
              }))}
            />
          </Section>

          <Section
            title="Fuel"
            headline={`${report.fuel.daysLogged} day${report.fuel.daysLogged === 1 ? "" : "s"}`}
            detail={
              report.fuel.meals === 0
                ? "No meals recorded in this period."
                : `${report.fuel.meals} meal${report.fuel.meals === 1 ? "" : "s"} recorded across ${report.fuel.daysLogged} of ${REPORT_DAYS} days`
            }
          >
            <WeekBars
              colour={MARCO}
              unitLabel="Days with a meal logged"
              bars={weeks.map((w) => ({
                label: w.shortLabel,
                value: w.mealDays,
                display: `${w.mealDays}/7`,
              }))}
            />
          </Section>
        </>
      )}

      <p className="text-[11px] text-foreground-muted">
        Four equal weeks rather than a ragged thirty days, so one week can be
        compared with the next. A week with nothing logged is shown as empty
        rather than as a zero &mdash; a week off and a week unrecorded are not
        the same thing.
      </p>
    </div>
  );
}
