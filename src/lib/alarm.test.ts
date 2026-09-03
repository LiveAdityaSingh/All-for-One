import { describe, expect, it } from "vitest";
import { alarmIntentUri, alarmReach, canSetAlarm } from "./alarm";

const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36";
const ANDROID_FIREFOX = "Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const DESKTOP =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

describe("where a handoff is possible", () => {
  it("is Android Chromium only", () => {
    expect(canSetAlarm(ANDROID_CHROME)).toBe(true);
    expect(canSetAlarm(ANDROID_FIREFOX)).toBe(false);
    expect(canSetAlarm(IPHONE)).toBe(false);
    expect(canSetAlarm(DESKTOP)).toBe(false);
  });
});

describe("when an alarm is the right tool", () => {
  const now = new Date("2026-09-03T09:00:00");

  it("offers it for a time later today", () => {
    expect(alarmReach("2026-09-03T17:00:00", now, true)).toBe("ready");
  });

  it("offers it right up to the 24 hour edge", () => {
    expect(alarmReach("2026-09-04T08:59:00", now, true)).toBe("ready");
  });

  // SET_ALARM has no date field, so past this point the alarm would ring
  // on the wrong day.
  it("withholds it beyond the next occurrence of that clock time", () => {
    expect(alarmReach("2026-09-04T09:30:00", now, true)).toBe("too-far");
    expect(alarmReach("2026-09-06T17:00:00", now, true)).toBe("too-far");
  });

  it("withholds it for the past, for undated tasks and off Android", () => {
    expect(alarmReach("2026-09-03T08:00:00", now, true)).toBe("past");
    expect(alarmReach(null, now, true)).toBe("no-time");
    expect(alarmReach("not a date", now, true)).toBe("no-time");
    expect(alarmReach("2026-09-03T17:00:00", now, false)).toBe("unsupported");
  });
});

describe("the intent handed to the clock app", () => {
  it("carries the hour, minute and title", () => {
    const uri = alarmIntentUri("Call the plumber", new Date("2026-09-03T17:05:00"));
    expect(uri).toContain("action=android.intent.action.SET_ALARM");
    expect(uri).toContain("i.android.intent.extra.alarm.HOUR=17");
    expect(uri).toContain("i.android.intent.extra.alarm.MINUTES=5");
    expect(uri).toContain("S.android.intent.extra.alarm.MESSAGE=Call%20the%20plumber");
    expect(uri.endsWith(";end")).toBe(true);
  });

  it("always lets the clock app confirm", () => {
    const uri = alarmIntentUri("Anything", new Date("2026-09-03T17:00:00"));
    expect(uri).toContain("B.android.intent.extra.alarm.SKIP_UI=false");
  });

  // A title is user input, and ; and = are what separate one part of an
  // intent URI from the next.
  it("cannot be broken out of by a title full of delimiters", () => {
    const uri = alarmIntentUri("a;end;action=android.intent.action.CALL;x=1", new Date("2026-09-03T07:00:00"));
    expect(uri.match(/;end/g)).toHaveLength(1);
    expect(uri).not.toContain("action=android.intent.action.CALL");
  });

  it("falls back to the app when nothing handles the intent", () => {
    const uri = alarmIntentUri("x", new Date("2026-09-03T07:00:00"), "https://example.com/lisa");
    expect(uri).toContain("S.browser_fallback_url=https%3A%2F%2Fexample.com%2Flisa");
  });
});
