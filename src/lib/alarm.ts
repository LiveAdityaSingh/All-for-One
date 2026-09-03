// Handing a reminder to the phone's own clock app.
//
// A web page cannot wake a sleeping phone: the Notifications API only
// fires while something is running, and the one spec that would have
// allowed a scheduled trigger never shipped. The device does have
// something that is allowed to ring at an arbitrary time, though - the
// clock app - and Android exposes it through an intent that Chrome will
// launch from a page. So rather than pretend, a reminder is handed over
// to the one component that can actually be relied on.
//
// The handoff is deliberately visible. The clock app opens pre-filled and
// the user confirms; nothing is created behind their back.

// Android's SET_ALARM carries an hour and a minute and no date, so the
// alarm always lands on the *next* occurrence of that clock time. Past
// this window it would ring on the wrong day, which is worse than not
// offering it, so the offer is withheld instead.
export const ALARM_WINDOW_MS = 24 * 60 * 60 * 1000;

export type AlarmReach =
  | "ready"
  | "unsupported" // no clock app reachable from this browser
  | "no-time" // an undated task has no moment to ring at
  | "past"
  | "too-far"; // beyond the next occurrence of that clock time

// There is no feature test for the intent: scheme, so this reads the
// platform directly. Deliberately conservative: a button that silently
// does nothing is worse than no button.
export function canSetAlarm(userAgent?: string): boolean {
  const ua = userAgent ?? (typeof navigator === "undefined" ? "" : navigator.userAgent);
  if (!/Android/i.test(ua)) return false;
  // Firefox on Android ignores intent: URIs.
  if (/Firefox|FxiOS/i.test(ua)) return false;
  return /Chrome|Chromium|SamsungBrowser|EdgA|OPR/i.test(ua);
}

export function alarmReach(
  dueAt: string | null,
  now: Date = new Date(),
  supported: boolean = canSetAlarm(),
): AlarmReach {
  if (!supported) return "unsupported";
  if (!dueAt) return "no-time";

  const at = new Date(dueAt);
  if (Number.isNaN(at.getTime())) return "no-time";

  const delta = at.getTime() - now.getTime();
  if (delta <= 0) return "past";
  if (delta > ALARM_WINDOW_MS) return "too-far";
  return "ready";
}

// Android's intent URI syntax: extras are typed by prefix - S. for string,
// i. for int, B. for boolean - and every value is URL-encoded, which is
// also what keeps a task title containing ";" or "=" from breaking out of
// the URI and rewriting the intent.
export function alarmIntentUri(title: string, at: Date, fallbackUrl?: string): string {
  const message = title.trim() || "Reminder";

  const parts = [
    "action=android.intent.action.SET_ALARM",
    `i.android.intent.extra.alarm.HOUR=${at.getHours()}`,
    `i.android.intent.extra.alarm.MINUTES=${at.getMinutes()}`,
    `S.android.intent.extra.alarm.MESSAGE=${encodeURIComponent(message)}`,
    // false, so the clock app shows its own confirmation rather than
    // creating an alarm silently.
    "B.android.intent.extra.alarm.SKIP_UI=false",
  ];

  // Without this Chrome shows an error page on a device with no clock app.
  if (fallbackUrl) parts.push(`S.browser_fallback_url=${encodeURIComponent(fallbackUrl)}`);

  return `intent:#Intent;${parts.join(";")};end`;
}

export function openAlarmApp(title: string, at: Date): void {
  if (typeof window === "undefined") return;
  window.location.href = alarmIntentUri(title, at, window.location.href);
}
