// Handing a dated reminder to an app on the phone that can actually ring.
//
// A web page cannot schedule a future alert: the Notifications API only
// fires while something is running, and the one spec that would have
// allowed a scheduled trigger never shipped. The device does have
// components that are allowed to interrupt at an arbitrary time - the
// clock app and the calendar - and Android exposes both through intents
// that Chrome will launch from a page. So rather than pretend, a reminder
// is handed to whichever of them is right for how far away it is.
//
// Every handoff is deliberately visible: the target app opens pre-filled
// and the user confirms. Nothing is created behind their back.

// Android's SET_ALARM carries an hour and a minute and no date, so the
// alarm always lands on the *next* occurrence of that clock time. Past
// this window an alarm would ring on the wrong day, and the reminder goes
// to the calendar instead, which does take an absolute date.
export const ALARM_WINDOW_MS = 24 * 60 * 60 * 1000;

// A reminder is a moment, not a meeting, but a zero-length event renders
// as a sliver in most calendar apps.
const EVENT_MINUTES = 30;

export type Handoff = "alarm" | "calendar" | "none";

// There is no feature test for the intent: scheme, so this reads the
// platform directly. Deliberately conservative: a button that silently
// does nothing is worse than no button.
export function canHandOff(userAgent?: string): boolean {
  const ua = userAgent ?? (typeof navigator === "undefined" ? "" : navigator.userAgent);
  if (!/Android/i.test(ua)) return false;
  // Firefox on Android ignores intent: URIs.
  if (/Firefox|FxiOS/i.test(ua)) return false;
  return /Chrome|Chromium|SamsungBrowser|EdgA|OPR/i.test(ua);
}

export function handoffFor(
  dueAt: string | null,
  now: Date = new Date(),
  supported: boolean = canHandOff(),
): Handoff {
  if (!supported || !dueAt) return "none";

  const at = new Date(dueAt);
  if (Number.isNaN(at.getTime())) return "none";

  const delta = at.getTime() - now.getTime();
  // Nothing to hand over for a moment that has already passed.
  if (delta <= 0) return "none";
  return delta > ALARM_WINDOW_MS ? "calendar" : "alarm";
}

// Android's intent URI syntax: extras are typed by prefix - S. string,
// i. int, l. long, B. boolean - and every value is URL-encoded, which is
// also what stops a task title containing ";" or "=" from breaking out of
// the URI and rewriting the intent into some other action.
function buildIntentUri(head: string, parts: string[], fallbackUrl?: string): string {
  // Without this Chrome shows an error page on a device with no app to
  // handle the intent.
  const all = fallbackUrl
    ? [...parts, `S.browser_fallback_url=${encodeURIComponent(fallbackUrl)}`]
    : parts;
  return `${head};${all.join(";")};end`;
}

export function alarmIntentUri(title: string, at: Date, fallbackUrl?: string): string {
  return buildIntentUri(
    "intent:#Intent",
    [
      "action=android.intent.action.SET_ALARM",
      `i.android.intent.extra.alarm.HOUR=${at.getHours()}`,
      `i.android.intent.extra.alarm.MINUTES=${at.getMinutes()}`,
      `S.android.intent.extra.alarm.MESSAGE=${encodeURIComponent(title.trim() || "Reminder")}`,
      // false, so the clock app shows its own confirmation rather than
      // creating an alarm silently.
      "B.android.intent.extra.alarm.SKIP_UI=false",
    ],
    fallbackUrl,
  );
}

// ACTION_INSERT against the calendar provider. Unlike an alarm this takes
// absolute timestamps, which is the whole reason anything further out than
// a day comes here instead.
export function calendarIntentUri(title: string, at: Date, fallbackUrl?: string): string {
  const begin = at.getTime();
  return buildIntentUri(
    // Resolves to the data URI content://com.android.calendar/events.
    "intent://com.android.calendar/events#Intent;scheme=content",
    [
      "action=android.intent.action.INSERT",
      `S.title=${encodeURIComponent(title.trim() || "Reminder")}`,
      `l.beginTime=${begin}`,
      `l.endTime=${begin + EVENT_MINUTES * 60 * 1000}`,
    ],
    fallbackUrl,
  );
}

export function openHandoff(kind: Handoff, title: string, at: Date): void {
  if (typeof window === "undefined" || kind === "none") return;
  const build = kind === "alarm" ? alarmIntentUri : calendarIntentUri;
  window.location.href = build(title, at, window.location.href);
}
