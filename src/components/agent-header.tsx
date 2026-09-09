"use client";

import { useEffect, useRef, useState } from "react";
import { Menu } from "lucide-react";
import { AppLink } from "@/components/app-link";
import { useAgentName } from "@/lib/use-agent-names";
import type { AgentId } from "@/lib/types";

export interface MenuItem {
  label: string;
  href?: string;
  onSelect?: () => void;
  // Shown under the label: what the option is for, since an icon-only
  // trigger gives no clue what is behind it.
  hint?: string;
}

// Every agent screen opened with a different header - one had a subtitle
// and an action, one had four equal-weight text links squeezed into a row,
// two had a bare title. This is the one header they all use now, so a
// screen cannot invent its own again.
export function AgentHeader({
  agent,
  subtitle,
  items = [],
  children,
}: {
  agent: AgentId;
  subtitle: string;
  items?: MenuItem[];
  children?: React.ReactNode;
}) {
  const name = useAgentName(agent);
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  // A menu that only closes by pressing its own button is a trap on a
  // phone, where there is no obvious "outside" to click.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <header className="flex items-start justify-between gap-2 px-4">
      <div className="min-w-0">
        <h1
          className="agent-text-glow truncate text-2xl font-semibold"
          style={{ color: `var(--color-${agent})`, ["--glow" as string]: `var(--color-${agent})` }}
        >
          {name}
        </h1>
        <p className="text-xs text-foreground-muted">{subtitle}</p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {children}

        {items.length > 0 && (
          <div ref={wrapper} className="relative">
            <button
              onClick={() => setOpen((v) => !v)}
              data-tour="menu"
              aria-label={`${name} menu`}
              aria-haspopup="menu"
              aria-expanded={open}
              // 44px, the smallest target a thumb reliably hits - the row of
              // text links this replaces was about half that.
              className="flex h-11 w-11 items-center justify-center rounded-full border"
              style={{
                borderColor: `var(--color-${agent}-muted)`,
                color: `var(--color-${agent})`,
                backgroundColor: open
                  ? `color-mix(in oklch, var(--color-${agent}) 16%, transparent)`
                  : "transparent",
              }}
            >
              <Menu size={20} strokeWidth={2.2} aria-hidden />
            </button>

            {open && (
              <div
                role="menu"
                className="lip absolute right-0 z-30 mt-2 flex w-60 flex-col overflow-hidden rounded-xl border bg-background-elevated"
                style={{ borderColor: "var(--border)" }}
              >
                {items.map((item, i) => {
                  const inner = (
                    <>
                      <span className="text-sm">{item.label}</span>
                      {item.hint && (
                        <span className="text-xs text-foreground-muted">{item.hint}</span>
                      )}
                    </>
                  );
                  const className =
                    "flex flex-col gap-0.5 px-3 py-2.5 text-left" +
                    (i > 0 ? " border-t border-border" : "");

                  return item.href ? (
                    <AppLink
                      key={item.label}
                      href={item.href}
                      role="menuitem"
                      className={className}
                      onClick={() => setOpen(false)}
                    >
                      {inner}
                    </AppLink>
                  ) : (
                    <button
                      key={item.label}
                      role="menuitem"
                      className={className}
                      onClick={() => {
                        setOpen(false);
                        item.onSelect?.();
                      }}
                    >
                      {inner}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
