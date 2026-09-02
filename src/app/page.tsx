"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { AppLink } from "@/components/app-link";
import { BannerZone } from "@/components/banner-zone";
import { ChatInputBar } from "@/components/chat-input-bar";
import { JarvisOrb } from "@/components/orb/jarvis-orb";
import { db } from "@/lib/db";
import { buildDailyDigest } from "@/lib/nudge-engine";
import { useHasMounted } from "@/lib/use-has-mounted";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// This page is static-exported (build spec: no server), so the HTML
// shell is frozen at build time - "now" in that shell is always stale
// by the time a real user opens it. Compute date/greeting only after
// mount instead of trusting server-rendered "now" text, which also
// sidesteps Node/browser Intl formatting differences during hydration.
function formatDate(date: Date): string {
  return `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const ONBOARDING_STEPS = [
  { href: "/tony/new", label: "Add your first application" },
  { href: "/tony/import", label: "Or import from a CSV" },
  { href: "/tony/claims", label: "Confirm a claim for your CV" },
];

export default function JarvisLanding() {
  // Any agent having data means the user is past the cold start - the
  // onboarding checklist would otherwise still claim the app is empty
  // while Vanessa is tracking accounts and Marco has sessions logged.
  const dataCount = useLiveQuery(async () => {
    const counts = await Promise.all([
      db.applications.count(),
      db.accounts.count(),
      db.tasks.count(),
      db.captures.count(),
    ]);
    return counts.reduce((sum, n) => sum + n, 0);
  }, []);
  const digest = useLiveQuery(() => buildDailyDigest(), []);
  const now = useHasMounted() ? new Date() : null;

  const hasData = (dataCount ?? 0) > 0;
  const warningCount = digest?.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between px-4">
        <div>
          <p className="text-sm text-foreground-muted">{now ? formatDate(now) : " "}</p>
          <h1 className="text-xl font-semibold">{now ? greeting(now.getHours()) : " "}</h1>
        </div>
        <AppLink href="/settings" className="text-xs text-foreground-muted underline">
          Settings
        </AppLink>
      </div>

      {hasData ? (
        <JarvisOrb warningCount={warningCount} />
      ) : (
        <div className="mx-4 flex flex-col gap-3 rounded-xl border border-border bg-background-elevated p-4">
          <p className="text-sm text-foreground-muted">Nothing here yet. Start with one of these:</p>
          {ONBOARDING_STEPS.map((step) => (
            <AppLink
              key={step.href}
              href={step.href}
              className="rounded-lg px-3 py-2 text-sm font-medium"
              style={{ backgroundColor: "var(--color-tony-muted)", color: "var(--background)" }}
            >
              {step.label}
            </AppLink>
          ))}
        </div>
      )}

      <BannerZone />
      <ChatInputBar variant="jarvis" />
    </div>
  );
}
