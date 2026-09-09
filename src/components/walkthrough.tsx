"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { TOUR_STEPS } from "@/lib/tour";
import { useOpeningStore } from "@/store/opening-store";

const SEEN_KEY = "seen_walkthrough";
const PADDING = 8;
const TAB_PADDING = 4;
const DIM = "rgba(8, 10, 14, 0.86)";

interface Hole {
  top: number;
  left: number;
  width: number;
  height: number;
  radius: number;
}

export function hasSeenWalkthrough(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

// A real subscription rather than a one-shot read, so asking to see the
// tour again takes effect where you stand instead of needing a reload.
let seenCache: boolean | undefined;
const listeners = new Set<() => void>();

const subscribeSeen = (onChange: () => void) => {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
};
const seenSnapshot = () => {
  if (seenCache === undefined) seenCache = hasSeenWalkthrough();
  return seenCache;
};
// Treated as seen on the server, so the prerendered HTML never contains a
// tour the client might not want.
const seenOnServer = () => true;

function setSeen(seen: boolean): void {
  seenCache = seen;
  try {
    if (seen) window.localStorage.setItem(SEEN_KEY, "1");
    else window.localStorage.removeItem(SEEN_KEY);
  } catch {
    // A tour that cannot be remembered runs again. Survivable.
  }
  listeners.forEach((notify) => notify());
}

export function forgetWalkthrough(): void {
  setSeen(false);
}

function rectOf(el: Element, pad: number, radius: number): Hole {
  const box = el.getBoundingClientRect();
  return {
    top: box.top - pad,
    left: box.left - pad,
    width: box.width + pad * 2,
    height: box.height + pad * 2,
    radius,
  };
}

// A guided first run.
//
// The screen dims and one thing at a time is cut out of the dark, with a
// line about what it is for. The agent whose section you are in keeps its
// tab icon lit for the whole run of its steps, so it is always clear whose
// walkthrough this is. The general steps - the opening, the way in, the
// tab bar itself, the closing - belong to no agent and light none.
export function Walkthrough() {
  const router = useRouter();
  const pathname = usePathname();
  const introDone = useOpeningStore((s) => s.introDone);

  const alreadySeen = useSyncExternalStore(subscribeSeen, seenSnapshot, seenOnServer);
  const [index, setIndex] = useState(0);
  // Kept with the step it belongs to, so a measurement from the previous
  // step can never be shown against this one.
  const [measured, setMeasured] = useState<{
    id: string;
    target: Hole | null;
    tab: Hole | null;
  } | null>(null);

  const step = TOUR_STEPS[index];

  // Derived rather than stored: nothing here needs to be set from an
  // effect, which would cascade a render on every step.
  const running = introDone && !alreadySeen;
  const onRoute = !step?.route || pathname === step.route;
  const current = measured && step && measured.id === step.id && onRoute ? measured : null;
  const hole = current?.target ?? null;

  const finish = useCallback(() => {
    // Back to the start, so asking to see it again begins at the beginning.
    setIndex(0);
    setSeen(true);
  }, []);

  // Each step may live on another screen, so the route is settled first
  // and only then are the cut-outs measured - measuring during a
  // navigation gives the position of something about to be replaced.
  useEffect(() => {
    if (!running || !step) return;

    if (step.route && pathname !== step.route) {
      router.push(step.route);
      return;
    }

    let cancelled = false;
    let attempts = 0;

    // The tab is always there, so it is lit at once. Waiting for the
    // target first meant a step whose target does not exist yet - nothing
    // overdue, no habit run - spent the whole retry loop identifying no
    // agent at all.
    const settle = (targetEl: Element | null) => {
      if (cancelled) return;
      const tabEl = step.agent
        ? document.querySelector(`[data-tour-tab="${step.agent}"]`)
        : null;
      setMeasured({
        id: step.id,
        target: targetEl ? rectOf(targetEl, PADDING, 16) : null,
        tab: tabEl ? rectOf(tabEl, TAB_PADDING, 12) : null,
      });
    };

    const measure = () => {
      if (cancelled) return;

      const targetEl = step.target
        ? document.querySelector(`[data-tour="${step.target}"]`)
        : null;

      if (targetEl) {
        targetEl.scrollIntoView({ block: "center", behavior: "auto" });
        // Measured after the scroll settles, or the rect is the one it had
        // on the way there.
        window.setTimeout(() => settle(targetEl), 120);
        return;
      }

      settle(null);

      // The screen may still be painting; keep looking for a few frames
      // before settling for a step with no cut-out of its own.
      if (step.target && attempts++ < 20) window.setTimeout(measure, 80);
    };

    measure();
    return () => {
      cancelled = true;
    };
  }, [running, step, pathname, router]);

  // Escape leaves, the way it does everywhere else.
  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [running, finish]);

  if (!running || !step) return null;

  const last = index === TOUR_STEPS.length - 1;
  const viewportH = typeof window === "undefined" ? 800 : window.innerHeight;

  // The card sits on whichever side of the cut-out has more room, so it
  // never covers the thing it is describing - and is then clamped into the
  // screen, because a tall target left too little room beneath it and
  // pushed the card out of sight entirely.
  const ROOM = 260;
  const above = hole ? hole.top : 0;
  const beneath = hole ? viewportH - (hole.top + hole.height) : viewportH;
  const below = !hole || beneath >= above;

  const position = !hole
    ? { top: "38%" }
    : below
      ? { top: Math.min(hole.top + hole.height + 16, Math.max(16, viewportH - ROOM)) }
      : { bottom: Math.min(viewportH - hole.top + 16, Math.max(16, viewportH - ROOM)) };

  const holes = [current?.target, current?.tab].filter((h): h is Hole => h != null);

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Walkthrough">
      {/*
        A mask rather than a spread shadow: the shadow trick can only ever
        cut one hole, and a step needs two - the thing being explained, and
        the tab of the agent it belongs to.
      */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {holes.map((h, i) => (
              <rect
                key={i}
                x={h.left}
                y={h.top}
                width={h.width}
                height={h.height}
                rx={h.radius}
                fill="black"
              />
            ))}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill={DIM} mask="url(#tour-mask)" />
      </svg>

      {/* Catches taps outside the card so nothing behind the dark is
          pressed by accident. */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      <div className="absolute left-0 right-0 px-5" style={position}>
        {/* Capped and scrollable, so a long step on a short screen is
            still readable and its buttons are still reachable. */}
        <div
          className="lip mx-auto flex max-w-sm flex-col gap-3 overflow-y-auto rounded-2xl border border-border bg-background-elevated p-4"
          style={{ maxHeight: viewportH - 32 }}
        >
          <div>
            <h2 className="text-base font-semibold">{step.title}</h2>
            <p className="mt-1.5 text-sm text-foreground-muted">{step.body}</p>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] tabular-nums text-foreground-muted">
              {index + 1} of {TOUR_STEPS.length}
            </span>

            <div className="flex items-center gap-2">
              {!last && (
                <button
                  onClick={finish}
                  className="rounded-full px-3 py-1.5 text-xs text-foreground-muted underline"
                >
                  Skip
                </button>
              )}
              <button
                autoFocus
                onClick={() => (last ? finish() : setIndex((i) => i + 1))}
                className="rounded-full px-4 py-2 text-sm font-medium"
                style={{ backgroundColor: "var(--color-jarvis)", color: "var(--background)" }}
              >
                {last ? "Start" : "Next"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
