// The one thing the app asks of you by default.
//
// Everything else here is opt-in, which leaves a new user on an empty
// screen with no reason to come back tomorrow. This is the evening
// close-out from the build spec (§11): a single daily habit at 10pm to
// bring the day's spending, sleep and sessions up to date, which is also
// what makes every other figure in the app worth trusting.
import { db } from "./db";

// A fixed id rather than a generated one, so restoring a backup that
// already contains it cannot produce a second copy.
export const DAILY_REVIEW_ID = "daily-review";
export const DAILY_REVIEW_TITLE = "Update today's details";
export const DAILY_REVIEW_HOUR = 22;

const SEEDED_KEY = "seeded_daily_review";

// Deliberately device-local: it lives in settings, which never travels in
// a backup, so a restore onto a fresh phone still seeds correctly while a
// deletion on this one is still respected here.
async function alreadySeeded(): Promise<boolean> {
  return (await db.settings.get(SEEDED_KEY)) !== undefined;
}

export function reviewTimeOn(day: Date): Date {
  const at = new Date(day);
  at.setHours(DAILY_REVIEW_HOUR, 0, 0, 0);
  return at;
}

// Runs on every launch and does nothing on almost all of them. Returns
// whether it actually created anything, which is what the tests assert on.
export async function seedDailyReview(now: Date = new Date()): Promise<boolean> {
  // Already there: nothing to do, and never a second copy.
  if (await db.tasks.get(DAILY_REVIEW_ID)) return false;

  // Seeded once before and since removed. Someone who deletes a suggestion
  // has said what they think of it, and an app that puts it back every
  // launch is not offering a default, it is nagging.
  if (await alreadySeeded()) return false;

  await db.tasks.put({
    id: DAILY_REVIEW_ID,
    title: DAILY_REVIEW_TITLE,
    kind: "habit",
    weekdays: null,
    timesPerDay: 1,
    completedToday: 0,
    streak: 0,
    streakDay: null,
    dueAt: reviewTimeOn(now).toISOString(),
    completedAt: null,
    lastCompletedOn: null,
    createdAt: now.toISOString(),
  });

  await db.settings.put({ key: SEEDED_KEY, value: now.toISOString() });
  return true;
}

// Whether the list holds nothing but the suggestion. The worked examples
// exist to show what a filled screen looks like, and a screen holding only
// the default is still, to the user, an empty one.
export function isOnlyDefault(ids: string[]): boolean {
  return ids.length === 0 || (ids.length === 1 && ids[0] === DAILY_REVIEW_ID);
}
