"use client";

import { usePathname } from "next/navigation";
import {
  Atom,
  BriefcaseBusiness,
  CalendarDays,
  HeartPulse,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { AppLink } from "@/components/app-link";
import type { AgentId } from "@/lib/types";

// Tab order and centre placement are both deliberate (build spec §5):
// Jarvis in the centre (easiest thumb target, mirrors the architecture),
// all five always shown at the same locked chroma - no muted inactive tabs.
// Each icon names the agent's domain; Jarvis's atom echoes the landing orb.
const TABS: { id: AgentId; label: string; href: string; icon: LucideIcon }[] = [
  { id: "tony", label: "Tony", href: "/tony", icon: BriefcaseBusiness },
  { id: "lisa", label: "Lisa", href: "/lisa", icon: CalendarDays },
  { id: "jarvis", label: "Jarvis", href: "/", icon: Atom },
  { id: "vanessa", label: "Vanessa", href: "/vanessa", icon: Wallet },
  { id: "marco", label: "Marco", href: "/marco", icon: HeartPulse },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="lip flex items-stretch border-t border-border bg-background-elevated">
      {TABS.map((tab) => {
        const isActive =
          tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        const Icon = tab.icon;

        return (
          <AppLink
            key={tab.id}
            href={tab.href}
            className="flex flex-1 flex-col items-center gap-1 py-3"
          >
            <Icon
              size={24}
              strokeWidth={isActive ? 2.4 : 2}
              style={{
                color: `var(--color-${tab.id})`,
                // Only the tab you are in is lit.
                filter: isActive
                  ? `drop-shadow(0 0 7px color-mix(in oklch, var(--color-${tab.id}) 70%, transparent))`
                  : undefined,
              }}
              aria-hidden
            />
            <span
              className={`text-sm ${isActive ? "font-semibold" : "font-normal"}`}
              style={{ color: `var(--color-${tab.id})` }}
            >
              {tab.label}
            </span>
            <span
              className="h-1 w-1 rounded-full"
              style={{
                backgroundColor: isActive ? `var(--color-${tab.id})` : "transparent",
              }}
            />
          </AppLink>
        );
      })}
    </nav>
  );
}
