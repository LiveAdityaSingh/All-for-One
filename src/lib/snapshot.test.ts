import { describe, expect, it } from "vitest";
import { isSnapshotDue, KEEP, takenAtFrom, toPrune, type SnapshotInfo } from "./snapshot";

const NOW = new Date("2026-09-08T20:00:00Z");
const snap = (iso: string): SnapshotInfo => ({
  name: `all-for-one-${iso.replace(/[:.]/g, "-")}.json`,
  takenAt: new Date(iso),
});

describe("reading the time back out of a filename", () => {
  it("round-trips the substitutions made to make it filename-safe", () => {
    const name = `all-for-one-${NOW.toISOString().replace(/[:.]/g, "-")}.json`;
    expect(takenAtFrom(name)?.toISOString()).toBe(NOW.toISOString());
  });

  it("ignores anything that is not one of ours", () => {
    expect(takenAtFrom("notes.txt")).toBeNull();
    expect(takenAtFrom("all-for-one-nonsense.json")).toBeNull();
    expect(takenAtFrom("all-for-one-2026-09-08T20-00-00-000Z.txt")).toBeNull();
  });
});

describe("when a snapshot is owed", () => {
  it("is owed when there has never been one", () => {
    expect(isSnapshotDue([], NOW)).toBe(true);
  });

  it("is not owed again the same day", () => {
    expect(isSnapshotDue([snap("2026-09-08T09:00:00Z")], NOW)).toBe(false);
  });

  it("is owed once a day has passed", () => {
    expect(isSnapshotDue([snap("2026-09-07T19:00:00Z")], NOW)).toBe(true);
  });

  // The list is newest-first, so a stale entry further down must not make
  // one look owed when today's already exists.
  it("judges by the newest, not the oldest", () => {
    const existing = [snap("2026-09-08T09:00:00Z"), snap("2026-08-01T09:00:00Z")];
    expect(isSnapshotDue(existing, NOW)).toBe(false);
  });
});

describe("pruning", () => {
  it("keeps a week and drops the rest", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      snap(new Date(NOW.getTime() - i * 86400000).toISOString()),
    );
    const pruned = toPrune(many);
    expect(pruned).toHaveLength(12 - KEEP);
    // The ones dropped are the oldest, never the newest.
    expect(pruned.every((p) => p.takenAt < many[KEEP - 1].takenAt)).toBe(true);
  });

  it("drops nothing while under the limit", () => {
    expect(toPrune([snap("2026-09-08T09:00:00Z")])).toEqual([]);
  });
});
