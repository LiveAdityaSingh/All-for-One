import { describe, expect, it } from "vitest";
import { criticalLoops } from "./open-loops";
import type { Account, JobApplication, Task } from "./types";

const NOW = new Date("2026-09-08T12:00:00");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString();

const app = (over: Partial<JobApplication> = {}): JobApplication => ({
  id: "a1", company: "Acme", role: "Engineer", stage: "applied",
  lifecycleStatus: "active", cvVariantId: null, appliedAt: daysAgo(30),
  stageEnteredAt: daysAgo(30), lastNudgedAt: null, nudgesIgnored: 0, notes: "", ...over,
});

const task = (over: Partial<Task> = {}): Task => ({
  id: "t1", title: "Something", kind: "one_off", dueAt: null,
  completedAt: null, lastCompletedOn: null, createdAt: daysAgo(10), ...over,
});

const account = (over: Partial<Account> = {}): Account => ({
  id: "c1", name: "Lloyds", goal: "", balance: 100, currency: "GBP",
  updatedAt: daysAgo(30), createdAt: daysAgo(60), ...over,
});

const empty = { applications: [], tasks: [], accounts: [] };

describe("a quiet day shows nothing", () => {
  it("returns none when nothing is owed", () => {
    expect(criticalLoops(empty, NOW)).toEqual([]);
  });

  it("ignores finished, decayed and fresh records", () => {
    const loops = criticalLoops(
      {
        applications: [app({ lifecycleStatus: "presumed_closed" })],
        tasks: [task({ dueAt: daysAgo(5), completedAt: daysAgo(1) })],
        accounts: [account({ updatedAt: daysAgo(1) })],
      },
      NOW,
    );
    expect(loops).toEqual([]);
  });
});

describe("gathering from every agent", () => {
  it("picks up an application, a task and a balance", () => {
    const loops = criticalLoops(
      {
        applications: [app()],
        tasks: [task({ dueAt: daysAgo(3) })],
        accounts: [account()],
      },
      NOW,
    );
    expect(loops.map((l) => l.agent).sort()).toEqual(["lisa", "tony", "vanessa"]);
  });

  // Marco describes, he does not chase (build spec §9).
  it("never speaks for Marco", () => {
    const loops = criticalLoops(
      { applications: [app()], tasks: [task({ dueAt: daysAgo(3) })], accounts: [account()] },
      NOW,
    );
    expect(loops.some((l) => l.agent === "marco")).toBe(false);
  });
});

describe("ordering", () => {
  it("puts overdue before merely soon", () => {
    const loops = criticalLoops(
      { applications: [], tasks: [task({ dueAt: daysAgo(2) })], accounts: [account()] },
      NOW,
    );
    expect(loops[0].severity).toBe("overdue");
    expect(loops[1].severity).toBe("soon");
  });

  it("puts the most overdue first", () => {
    const loops = criticalLoops(
      {
        applications: [],
        tasks: [
          task({ id: "recent", title: "Recent", dueAt: daysAgo(1) }),
          task({ id: "ancient", title: "Ancient", dueAt: daysAgo(9) }),
        ],
        accounts: [],
      },
      NOW,
    );
    expect(loops.map((l) => l.id)).toEqual(["ancient", "recent"]);
  });
});

describe("what each loop says", () => {
  it("counts the days on an overdue task", () => {
    const [loop] = criticalLoops({ ...empty, tasks: [task({ dueAt: daysAgo(3) })] }, NOW);
    expect(loop.text).toContain("3d late");
    expect(loop.href).toBe("/lisa");
  });

  it("names an unchecked balance as unknown rather than late", () => {
    const [loop] = criticalLoops({ ...empty, accounts: [account()] }, NOW);
    expect(loop.severity).toBe("soon");
    expect(loop.text).toContain("not checked");
  });

  it("links an application straight to its detail", () => {
    const [loop] = criticalLoops({ ...empty, applications: [app()] }, NOW);
    expect(loop.href).toBe("/tony/detail?id=a1");
  });
});
