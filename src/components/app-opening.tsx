"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useOpeningStore } from "@/store/opening-store";

const SEEN_INTRO = "seen_intro";

// The first launch gets the long version; every launch after gets a line
// and whatever fraction of a second the app actually takes.
type Phase = "pulse" | "expand" | "condense" | "gone";

const PULSE_MIN_MS = 900; // long enough for one full breath of the orb
const EXPAND_MS = 620;
// The settle is the part worth watching, so it gets the most time.
const CONDENSE_MS = 1400;
// Held at full strength while it travels, then faded only as it lands.
const FADE_MS = 300;


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

  // Only the first launch has an opening. Every launch after shows the app
  // straight away: the overlay had barely a frame to live in, so it read as
  // a flicker rather than a moment.
  const shown: Phase = skipIntro ? "gone" : phase;

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
        transition: `background-color ${Math.round(CONDENSE_MS * 0.7)}ms ease-out`,
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
          transition: (() => {
            const move = expanding ? EXPAND_MS : CONDENSE_MS;
            // Opening out is a push; settling is a glide, so they get
            // different curves rather than one shared easing.
            const ease = expanding
              ? "cubic-bezier(0.4, 0, 0.2, 1)"
              : "cubic-bezier(0.22, 1, 0.36, 1)";
            return [
              `width ${move}ms ${ease}`,
              `height ${move}ms ${ease}`,
              `margin ${move}ms ${ease}`,
              `left ${move}ms ${ease}`,
              `top ${move}ms ${ease}`,
              // Delayed to the end of the journey. Fading from the moment
              // the condense began meant the orb was invisible for most of
              // the travel it was supposed to be making.
              `opacity ${FADE_MS}ms ease-out ${condensing ? move - FADE_MS : 0}ms`,
            ].join(", ");
          })(),
          opacity: condensing ? 0 : 1,
        }}
      />
      )}

    </div>
  );
}
