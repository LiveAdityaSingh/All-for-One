"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  Atom,
  BriefcaseBusiness,
  CalendarDays,
  HeartPulse,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { AppLink } from "@/components/app-link";
import { useAgentNames } from "@/lib/use-agent-names";
import type { AgentId } from "@/lib/types";

// Labels are whatever the user calls each agent; only the order, the
// icons and the ids are fixed here.
//
// Tab order and centre placement are both deliberate (build spec §5):
// Jarvis in the centre (easiest thumb target, mirrors the architecture),
// all five always shown at the same locked chroma - no muted inactive tabs.
// Each icon names the agent's domain; Jarvis's atom echoes the landing orb.
const TABS: { id: AgentId; href: string; icon: LucideIcon }[] = [
  { id: "tony", href: "/tony", icon: BriefcaseBusiness },
  { id: "lisa", href: "/lisa", icon: CalendarDays },
  { id: "jarvis", href: "/", icon: Atom },
  { id: "vanessa", href: "/vanessa", icon: Wallet },
  { id: "marco", href: "/marco", icon: HeartPulse },
];

export function TabBar() {
  const pathname = usePathname();
  const names = useAgentNames();
  const navRef = useRef<HTMLElement>(null);

  // The bar is fixed to the viewport, so it no longer takes up space in the
  // document and content would scroll underneath it. Publishing its real
  // height lets .pb-tab-bar reserve exactly that strip. Measured rather than
  // hard-coded because the labels grow with the reader's system font size.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const publish = () =>
      document.documentElement.style.setProperty("--tab-bar-h", `${nav.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(nav);
    return () => observer.disconnect();
  }, []);

  return (
    <nav
      ref={navRef}
      data-tour="tabs"
      // Frozen to the bottom of the viewport rather than the end of the
      // document: the page below is free to scroll under it.
      className="lip fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-border bg-background-elevated"
      // Lifts the icons clear of the Android navigation bar, which the page
      // draws underneath thanks to viewportFit: "cover".
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
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
              {names[tab.id]}
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
