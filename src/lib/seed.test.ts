import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";
import {
  DAILY_REVIEW_HOUR,
  DAILY_REVIEW_ID,
  isOnlyDefault,
  reviewTimeOn,
  seedDailyReview,
} from "./seed";

const NOW = new Date("2026-09-09T09:00:00");

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("the default evening habit", () => {
  it("is created once, as a daily habit at 10pm", async () => {
    expect(await seedDailyReview(NOW)).toBe(true);

    const task = await db.tasks.get(DAILY_REVIEW_ID);
    expect(task?.kind).toBe("habit");
    expect(task?.timesPerDay).toBe(1);
    expect(task?.weekdays).toBeNull();
    expect(new Date(task!.dueAt as string).getHours()).toBe(DAILY_REVIEW_HOUR);
  });

  it("does nothing on every launch after the first", async () => {
    await seedDailyReview(NOW);
    expect(await seedDailyReview(NOW)).toBe(false);
    expect(await db.tasks.count()).toBe(1);
  });

  // Deleting a suggestion says what you think of it. Putting it back every
  // launch would not be a default, it would be nagging.
  it("stays gone once deleted", async () => {
    await seedDailyReview(NOW);
    await db.tasks.delete(DAILY_REVIEW_ID);

    expect(await seedDailyReview(NOW)).toBe(false);
    expect(await db.tasks.get(DAILY_REVIEW_ID)).toBeUndefined();
  });

  // A fixed id means a restored backup that already holds it cannot make
  // a second copy.
  it("never produces a duplicate", async () => {
    await seedDailyReview(NOW);
    await db.settings.clear(); // as if this were a different device
    expect(await seedDailyReview(NOW)).toBe(false);
    expect(await db.tasks.count()).toBe(1);
  });

  it("sets the reminder for tonight, not this morning", () => {
    const at = reviewTimeOn(NOW);
    expect(at.getHours()).toBe(22);
    expect(at.getDate()).toBe(NOW.getDate());
  });
});

describe("a screen holding only the suggestion is still empty", () => {
  it("counts nothing and the default alone as empty", () => {
    expect(isOnlyDefault([])).toBe(true);
    expect(isOnlyDefault([DAILY_REVIEW_ID])).toBe(true);
  });

  it("counts anything of the user's own as not empty", () => {
    expect(isOnlyDefault(["something-else"])).toBe(false);
    expect(isOnlyDefault([DAILY_REVIEW_ID, "something-else"])).toBe(false);
  });
});
