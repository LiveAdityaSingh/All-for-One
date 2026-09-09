"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { TOUR_STEPS } from "@/lib/tour";
import { useOpeningStore } from "@/store/opening-store";

const SEEN_KEY = "seen_walkthrough";
const PADDING = 8;

interface Hole {
  top: number;
  left: number;
  width: number;
  height: number;
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

// A guided first run.
//
// The screen dims and one thing at a time is cut out of the dark, with a
// line about what it is for. Between steps the cut-out closes, so the tour
// moves from "look here" to "look here" rather than sliding a window
// around the screen.
export function Walkthrough() {
  const router = useRouter();
  const pathname = usePathname();
  const introDone = useOpeningStore((s) => s.introDone);

  const alreadySeen = useSyncExternalStore(subscribeSeen, seenSnapshot, seenOnServer);
  const [index, setIndex] = useState(0);
  // Kept with the step it belongs to, so a measurement from the previous
  // step can never be shown against this one.
  const [measured, setMeasured] = useState<{ id: string; rect: Hole } | null>(null);

  const step = TOUR_STEPS[index];

  // Derived rather than stored: nothing here needs to be set from an
  // effect, which would cascade a render on every step.
  const running = introDone && !alreadySeen;
  const onRoute = !step?.route || pathname === step.route;
  const hole = measured && step && measured.id === step.id && onRoute ? measured.rect : null;

  const finish = useCallback(() => {
    // Back to the start, so asking to see it again begins at the beginning.
    setIndex(0);
    setSeen(true);
  }, []);

  // Each step may live on another screen, so the route is settled first
  // and only then is the target measured - measuring during a navigation
  // gives the position of something about to be replaced.
  useEffect(() => {
    if (!running || !step) return;

    if (step.route && pathname !== step.route) {
      router.push(step.route);
      return;
    }

    if (!step.target) return;

    let cancelled = false;
    let attempts = 0;

    const measure = () => {
      if (cancelled) return;
      const el = document.querySelector(`[data-tour="${step.target}"]`);

      if (!el) {
        // The screen may still be painting; give it a few frames before
        // giving up and leaving the step as a plain full-screen note.
        if (attempts++ < 20) window.setTimeout(measure, 80);
        return;
      }

      el.scrollIntoView({ block: "center", behavior: "auto" });
      window.setTimeout(() => {
        if (cancelled) return;
        const box = el.getBoundingClientRect();
        setMeasured({
          id: step.id,
          rect: {
            top: box.top - PADDING,
            left: box.left - PADDING,
            width: box.width + PADDING * 2,
            height: box.height + PADDING * 2,
          },
        });
      }, 120);
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

  // The card sits on whichever side of the cut-out has room, so it never
  // covers the thing it is describing.
  const viewportH = typeof window === "undefined" ? 800 : window.innerHeight;
  const viewportW = typeof window === "undefined" ? 400 : window.innerWidth;
  const below = !hole || hole.top + hole.height < viewportH * 0.55;

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Walkthrough">
      {/* One element does all the dimming: a huge spread shadow around the
          cut-out, which needs no mask and stays crisp at any size. */}
      <div
        className="absolute transition-all duration-300 ease-out"
        style={{
          // With no target the cut-out collapses to a point in the middle
          // of the screen rather than moving off it: the dimming is a
          // shadow spreading outwards from this box, so parking it at
          // -9999 spread the dark away from the viewport and left the
          // whole screen undimmed.
          top: hole?.top ?? viewportH / 2,
          left: hole?.left ?? viewportW / 2,
          width: hole?.width ?? 0,
          height: hole?.height ?? 0,
          borderRadius: 16,
          boxShadow: "0 0 0 9999px rgba(8, 10, 14, 0.86)",
          pointerEvents: "none",
        }}
      />

      {/* Catches taps outside the card so nothing behind the dark is
          pressed by accident. */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      <div
        className="absolute left-0 right-0 px-5"
        style={below ? { top: hole ? hole.top + hole.height + 16 : "38%" } : { bottom: viewportH - (hole?.top ?? 0) + 16 }}
      >
        <div className="lip mx-auto flex max-w-sm flex-col gap-3 rounded-2xl border border-border bg-background-elevated p-4">
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
