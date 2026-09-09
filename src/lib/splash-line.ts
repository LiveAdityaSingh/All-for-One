// The one line shown while the app opens.
//
// Measured on a mid-range phone, the whole cold start is about 1.6s and
// only ~400ms of that is the WebView, so this is deliberately built to be
// read in a glance or missed entirely. It is never given a minimum display
// time: it fills real waiting on a slow launch and is invisible on a fast
// one, rather than manufacturing a pause to be admired.
//
// It is cached rather than computed, because computing it needs the
// database open - which is the slow part it is meant to cover.

const KEY = "splash_line";

export interface SplashLine {
  text: string;
  // True when it came from the user's own data. Kept so a stale personal
  // line can be told apart from a quote.
  personal: boolean;
}

// Used only when there is nothing true to say yet - a first launch, or an
// app with no data. Deliberately few: a long list of borrowed aphorisms
// would still be wallpaper by the second week, and the personal line is
// the one that is meant to carry this.
export const FALLBACK_LINES = [
  "One thing, then the next.",
  "The day is easier to fix than the year.",
  "Small entries beat perfect records.",
  "You cannot manage what you never wrote down.",
  "Nothing here needs to be impressive.",
] as const;

export interface SplashInput {
  // Longest live habit run, with what it belongs to.
  streak: { days: number; title: string } | null;
  openLoops: number;
  sessionsThisWeek: number;
}

// Ordered by how much it deserves the moment: a run you could break today
// beats a count of chores, which beats a number about last week.
export function buildSplashLine(input: SplashInput, day: number = 0): SplashLine {
  const { streak, openLoops, sessionsThisWeek } = input;

  if (streak && streak.days > 1) {
    return { text: `${streak.days}-day run on ${streak.title}`, personal: true };
  }

  if (openLoops > 0) {
    return {
      text: `${openLoops} thing${openLoops === 1 ? "" : "s"} waiting on you`,
      personal: true,
    };
  }

  if (sessionsThisWeek > 0) {
    return {
      text: `${sessionsThisWeek} session${sessionsThisWeek === 1 ? "" : "s"} logged this week`,
      personal: true,
    };
  }

  // Rotates by day rather than at random, so opening the app twice in a
  // row does not look like it is shuffling for effect.
  const index = Math.abs(Math.trunc(day)) % FALLBACK_LINES.length;
  return { text: FALLBACK_LINES[index], personal: false };
}

export function readSplashLine(): SplashLine | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const { text, personal } = parsed as Partial<SplashLine>;
    return typeof text === "string" && text.length > 0
      ? { text, personal: personal === true }
      : null;
  } catch {
    return null;
  }
}

export function writeSplashLine(line: SplashLine): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(line));
  } catch {
    // A line that cannot be cached costs the next launch its greeting,
    // nothing more.
  }
}
