import { describe, expect, it } from "vitest";
import { computeRunway, isStale, STALE_AFTER_DAYS } from "./finance";
import type { Account, BalanceSnapshot } from "./types";

const NOW = new Date("2026-06-30T12:00:00");

function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();
}

function account(partial: Partial<Account>): Account {
  return {
    id: "a1",
    name: "Monzo",
    goal: "Living costs",
    balance: 1000,
    currency: "GBP",
    updatedAt: daysAgo(1),
    createdAt: daysAgo(60),
    ...partial,
  };
}

function snapshot(partial: Partial<BalanceSnapshot>): BalanceSnapshot {
  return { id: "s1", accountId: "a1", balance: 1000, recordedAt: daysAgo(30), ...partial };
}

describe("staleness", () => {
  it("is fresh inside the weekly window", () => {
    expect(isStale(account({ updatedAt: daysAgo(STALE_AFTER_DAYS - 1) }), NOW)).toBe(false);
  });

  it("goes stale once the window passes", () => {
    expect(isStale(account({ updatedAt: daysAgo(STALE_AFTER_DAYS) }), NOW)).toBe(true);
  });
});

describe("runway", () => {
  it("derives months from how balances actually moved", () => {
    // £3000 down to £2000 over 30 days = £1000/month burn, £2000 left.
    const result = computeRunway(
      [account({ balance: 2000 })],
      [snapshot({ balance: 3000, recordedAt: daysAgo(30) })],
      NOW,
    );
    expect(result.state).toBe("ok");
    expect(Math.round(result.monthlyBurn!)).toBe(1000);
    expect(result.months).toBeCloseTo(2, 1);
  });

  it("refuses to state a number without enough history", () => {
    const result = computeRunway(
      [account({ balance: 2000 })],
      [snapshot({ balance: 2200, recordedAt: daysAgo(2) })],
      NOW,
    );
    expect(result.state).toBe("insufficient_history");
    expect(result.months).toBeNull();
  });

  it("reports growth rather than dividing by a negative burn", () => {
    const result = computeRunway(
      [account({ balance: 4000 })],
      [snapshot({ balance: 3000, recordedAt: daysAgo(30) })],
      NOW,
    );
    expect(result.state).toBe("growing");
    expect(result.months).toBeNull();
  });

  it("flags the number as resting on stale inputs", () => {
    const result = computeRunway(
      [account({ balance: 2000, updatedAt: daysAgo(21) })],
      [snapshot({ balance: 3000, recordedAt: daysAgo(30) })],
      NOW,
    );
    expect(result.state).toBe("stale");
    expect(result.staleAccounts).toEqual(["Monzo"]);
    // The figure still exists so it can be shown desaturated and labelled,
    // rather than vanishing with no explanation.
    expect(result.months).not.toBeNull();
  });

  it("handles having no accounts at all", () => {
    expect(computeRunway([], [], NOW).state).toBe("no_accounts");
  });

  it("does not treat a newly added account as income", () => {
    // The second account is added today with its own opening snapshot; it
    // must not make the burn rate look better than it is.
    const accounts = [
      account({ id: "a1", balance: 2000 }),
      account({ id: "a2", name: "Savings", balance: 5000, updatedAt: daysAgo(0) }),
    ];
    const snapshots = [
      snapshot({ id: "s1", accountId: "a1", balance: 3000, recordedAt: daysAgo(30) }),
      snapshot({ id: "s2", accountId: "a2", balance: 5000, recordedAt: daysAgo(0) }),
    ];
    const result = computeRunway(accounts, snapshots, NOW);
    // Burn still reflects the £1000 actually spent from a1.
    expect(Math.round(result.monthlyBurn!)).toBe(1000);
    expect(result.totalBalance).toBe(7000);
  });
});
