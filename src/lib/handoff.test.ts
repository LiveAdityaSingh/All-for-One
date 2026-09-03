import { describe, expect, it } from "vitest";
import { alarmIntentUri, calendarIntentUri, canHandOff, handoffFor } from "./handoff";

const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36";
const ANDROID_FIREFOX = "Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const DESKTOP =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

describe("where a handoff is possible", () => {
  it("is Android Chromium only", () => {
    expect(canHandOff(ANDROID_CHROME)).toBe(true);
    expect(canHandOff(ANDROID_FIREFOX)).toBe(false);
    expect(canHandOff(IPHONE)).toBe(false);
    expect(canHandOff(DESKTOP)).toBe(false);
  });
});

describe("choosing which app to hand to", () => {
  const now = new Date("2026-09-03T09:00:00");

  it("uses an alarm for a time later today", () => {
    expect(handoffFor("2026-09-03T17:00:00", now, true)).toBe("alarm");
  });

  it("uses an alarm right up to the 24 hour edge", () => {
    expect(handoffFor("2026-09-04T08:59:00", now, true)).toBe("alarm");
  });

  // SET_ALARM has no date field, so past this point an alarm would ring on
  // the wrong day and the calendar takes over.
  it("switches to the calendar once an alarm would ring on the wrong day", () => {
    expect(handoffFor("2026-09-04T09:30:00", now, true)).toBe("calendar");
    expect(handoffFor("2026-09-06T17:00:00", now, true)).toBe("calendar");
    expect(handoffFor("2027-01-01T09:00:00", now, true)).toBe("calendar");
  });

  it("offers nothing for the past, for undated tasks and off Android", () => {
    expect(handoffFor("2026-09-03T08:00:00", now, true)).toBe("none");
    expect(handoffFor(null, now, true)).toBe("none");
    expect(handoffFor("not a date", now, true)).toBe("none");
    expect(handoffFor("2026-09-03T17:00:00", now, false)).toBe("none");
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
    expect(alarmIntentUri("Anything", new Date("2026-09-03T17:00:00"))).toContain(
      "B.android.intent.extra.alarm.SKIP_UI=false",
    );
  });
});

describe("the intent handed to the calendar", () => {
  const at = new Date("2026-09-06T17:00:00");

  it("targets the calendar provider with an absolute time", () => {
    const uri = calendarIntentUri("Renew passport", at);
    expect(uri.startsWith("intent://com.android.calendar/events#Intent;scheme=content")).toBe(true);
    expect(uri).toContain("action=android.intent.action.INSERT");
    expect(uri).toContain("S.title=Renew%20passport");
    expect(uri).toContain(`l.beginTime=${at.getTime()}`);
  });

  // A zero-length event renders as an unreadable sliver, so a reminder is
  // given a half-hour body.
  it("gives the event a real duration", () => {
    const uri = calendarIntentUri("Renew passport", at);
    expect(uri).toContain(`l.endTime=${at.getTime() + 30 * 60 * 1000}`);
  });
});

// A title is user input, and ; and = are what separate one part of an
// intent URI from the next.
describe("a title cannot rewrite the intent", () => {
  const nasty = "a;end;action=android.intent.action.CALL;x=1";

  it("holds for the alarm", () => {
    const uri = alarmIntentUri(nasty, new Date("2026-09-03T07:00:00"));
    expect(uri.match(/;end/g)).toHaveLength(1);
    expect(uri).not.toContain("action=android.intent.action.CALL");
  });

  it("holds for the calendar", () => {
    const uri = calendarIntentUri(nasty, new Date("2026-09-06T07:00:00"));
    expect(uri.match(/;end/g)).toHaveLength(1);
    expect(uri).not.toContain("action=android.intent.action.CALL");
  });
});

describe("falling back when nothing handles the intent", () => {
  it("returns the user to the app", () => {
    expect(alarmIntentUri("x", new Date("2026-09-03T07:00:00"), "https://e.com/lisa")).toContain(
      "S.browser_fallback_url=https%3A%2F%2Fe.com%2Flisa",
    );
    expect(calendarIntentUri("x", new Date("2026-09-06T07:00:00"), "https://e.com/lisa")).toContain(
      "S.browser_fallback_url=https%3A%2F%2Fe.com%2Flisa",
    );
  });
});
