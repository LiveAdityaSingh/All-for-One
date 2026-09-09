"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useOpeningStore } from "@/store/opening-store";
import { readSplashLine, type SplashLine } from "@/lib/splash-line";

const SEEN_INTRO = "seen_intro";

// The first launch gets the long version; every launch after gets a line
// and whatever fraction of a second the app actually takes.
type Phase = "pulse" | "expand" | "condense" | "gone";

const PULSE_MIN_MS = 900; // long enough for one full breath of the orb
const EXPAND_MS = 520;
const CONDENSE_MS = 780;

// Read once per session and cached, so the snapshot React subscribes to is
// stable - a fresh object each call would spin it.
let cachedLine: SplashLine | null | undefined;

function lineSnapshot(): SplashLine | null {
  if (cachedLine === undefined) cachedLine = readSplashLine();
  return cachedLine;
}

// Null on the server, so the prerendered HTML and the first client render
// agree; the line appears on the pass after hydration.
const noServerLine = () => null;
const neverChanges = () => () => {};

// Reduced motion as a subscription rather than a render-time read, which
// would be impure, and as a primitive so the snapshot cannot spin.
const subscribeMotion = (onChange: () => void) => {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const motionSnapshot = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const noServerMotion = () => false;

function rememberIntroSeen(): void {
  try {
    window.localStorage.setItem(SEEN_INTRO, "1");
  } catch {
    // An intro that cannot be remembered plays twice. Harmless.
  }
}

function hasSeenIntro(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(SEEN_INTRO) === "1";
  } catch {
    return true;
  }
}

// Where the real Jarvis sphere is sitting, so the intro can land on it
// rather than merely near it. Falls back to the middle of the screen on
// any screen that has no sphere.
function orbRect(): { x: number; y: number; size: number } {
  const el = document.querySelector("[data-jarvis-orb]");
  if (el) {
    const box = el.getBoundingClientRect();
    if (box.width > 0) {
      return { x: box.left + box.width / 2, y: box.top + box.height / 2, size: box.width };
    }
  }
  return { x: window.innerWidth / 2, y: window.innerHeight / 2, size: 220 };
}

export function AppOpening() {
  const ready = useOpeningStore((s) => s.ready);

  // Decided once, before paint, so the first launch never flashes the
  // short version before switching.
  const [firstRun] = useState(() => !hasSeenIntro());
  const [phase, setPhase] = useState<Phase>("pulse");
  const [target, setTarget] = useState<{ x: number; y: number; size: number } | null>(null);
  const line = useSyncExternalStore(neverChanges, lineSnapshot, noServerLine);

  // Set at mount rather than during render: Date.now() in a render body is
  // impure and can drift between renders.
  const started = useRef(0);
  useEffect(() => {
    started.current = Date.now();
  }, []);

  const reducedMotion = useSyncExternalStore(subscribeMotion, motionSnapshot, noServerMotion);

  // Anyone who has asked for less motion gets the app, not a performance -
  // and so does every launch after the first.
  const skipIntro = !firstRun || reducedMotion;

  useEffect(() => {
    if (!ready || !skipIntro) return;
    rememberIntroSeen();
  }, [ready, skipIntro]);

  // Take away the splash that was painted with the document. Faded rather
  // than cut, so a fast launch does not flicker.
  useEffect(() => {
    if (!ready) return;
    const splash = document.getElementById("opening-splash");
    if (!splash) return;
    splash.classList.add("leaving");
    const timer = window.setTimeout(() => splash.remove(), 300);
    return () => window.clearTimeout(timer);
  }, [ready]);

  useEffect(() => {
    if (!ready || skipIntro) return;

    // The orb has had its breath; now it opens out and settles onto the
    // real sphere. Every transition is scheduled, never set synchronously,
    // so none of this cascades a render.
    const waited = Date.now() - started.current;
    const timers: number[] = [];

    timers.push(
      window.setTimeout(() => {
        setPhase("expand");
        timers.push(
          window.setTimeout(() => {
            setTarget(orbRect());
            setPhase("condense");
            timers.push(
              window.setTimeout(() => {
                setPhase("gone");
                rememberIntroSeen();
              }, CONDENSE_MS),
            );
          }, EXPAND_MS),
        );
      }, Math.max(0, PULSE_MIN_MS - waited)),
    );

    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [ready, skipIntro]);

  // On a later launch there is no sequence to run: the overlay is simply
  // there until the app is, which is usually a fraction of a second.
  const shown: Phase = skipIntro ? (ready ? "gone" : "pulse") : phase;

  if (shown === "gone") return null;

  const expanding = shown === "expand";
  const condensing = shown === "condense";

  // Big enough to clear the corners of any phone held either way round.
  const cover = typeof window === "undefined" ? 2000 : Math.hypot(window.innerWidth, window.innerHeight) * 2.2;
  const size = expanding ? cover : condensing ? (target?.size ?? 220) : 120;
  const left = condensing && target ? target.x : (typeof window === "undefined" ? 0 : window.innerWidth / 2);
  const top = condensing && target ? target.y : (typeof window === "undefined" ? 0 : window.innerHeight / 2);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
      style={{
        // The ground goes as the orb condenses, so the app is revealed by
        // the light drawing back rather than by a curtain lifting.
        backgroundColor: condensing ? "transparent" : "var(--background)",
        transition: `background-color ${CONDENSE_MS}ms ease-out`,
      }}
    >
      {!skipIntro && (
      <span
        className={shown === "pulse" ? "orb-breathe" : undefined}
        style={{
          position: "absolute",
          left,
          top,
          width: size,
          height: size,
          marginLeft: -size / 2,
          marginTop: -size / 2,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 50% 50%, color-mix(in oklch, var(--color-jarvis) 92%, transparent) 0%, color-mix(in oklch, var(--color-jarvis) 55%, transparent) 45%, transparent 70%)",
          transition: `width ${expanding ? EXPAND_MS : CONDENSE_MS}ms cubic-bezier(0.4, 0, 0.2, 1), height ${
            expanding ? EXPAND_MS : CONDENSE_MS
          }ms cubic-bezier(0.4, 0, 0.2, 1), margin ${
            expanding ? EXPAND_MS : CONDENSE_MS
          }ms cubic-bezier(0.4, 0, 0.2, 1), left ${CONDENSE_MS}ms ease-out, top ${CONDENSE_MS}ms ease-out, opacity 300ms ease-out`,
          opacity: condensing ? 0 : 1,
        }}
      />
      )}

      {/* Only on later launches: the first run has the orb to watch. */}
      {!firstRun && line && (
        <p
          className="absolute bottom-24 left-0 right-0 px-8 text-center text-sm text-foreground-muted"
          style={{ opacity: ready ? 0 : 1, transition: "opacity 260ms ease-out" }}
        >
          {line.text}
        </p>
      )}
    </div>
  );
}
