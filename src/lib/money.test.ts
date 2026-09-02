import { describe, expect, it } from "vitest";
import {
  inPeriod,
  resolvePeriod,
  spendByCategory,
  totalsFor,
  transactionsToCsv,
} from "./money";
import type { Transaction } from "./types";

// A Wednesday, so the week boundary is genuinely exercised.
const NOW = new Date("2026-06-17T14:00:00");

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: "t1",
    type: "expense",
    amount: 10,
    category: "Groceries",
    accountId: null,
    note: "",
    occurredAt: NOW.toISOString(),
    ...partial,
  };
}

describe("periods", () => {
  it("starts the week on Monday", () => {
    const { from } = resolvePeriod("week", NOW);
    expect(from.getDay()).toBe(1);
    expect(from.getDate()).toBe(15);
  });

  it("starts the month on the first", () => {
    expect(resolvePeriod("month", NOW).from.getDate()).toBe(1);
  });

  it("starts today at midnight", () => {
    const { from } = resolvePeriod("today", NOW);
    expect(from.getHours()).toBe(0);
    expect(from.getDate()).toBe(17);
  });

  it("excludes anything before the window", () => {
    const period = resolvePeriod("today", NOW);
    expect(inPeriod(tx({ occurredAt: "2026-06-16T23:00:00" }), period)).toBe(false);
    expect(inPeriod(tx({}), period)).toBe(true);
  });
});

describe("totals", () => {
  it("nets income against expenses in the period", () => {
    const period = resolvePeriod("month", NOW);
    const totals = totalsFor(
      [
        tx({ type: "income", amount: 2000 }),
        tx({ type: "expense", amount: 300 }),
        tx({ type: "expense", amount: 200 }),
      ],
      period,
    );
    expect(totals).toEqual({ income: 2000, expenses: 500, net: 1500 });
  });

  it("ignores transactions outside the period", () => {
    const period = resolvePeriod("today", NOW);
    const totals = totalsFor([tx({ amount: 99, occurredAt: "2026-05-01T10:00:00" })], period);
    expect(totals.expenses).toBe(0);
  });

  it("reports a negative net when spending exceeds income", () => {
    const period = resolvePeriod("month", NOW);
    expect(totalsFor([tx({ amount: 40 })], period).net).toBe(-40);
  });
});

describe("category breakdown", () => {
  it("groups spend and works out each share", () => {
    const period = resolvePeriod("month", NOW);
    const slices = spendByCategory(
      [
        tx({ category: "Groceries", amount: 60 }),
        tx({ category: "Transport", amount: 40 }),
        tx({ category: "Groceries", amount: 40 }),
        // Income must never appear in a spending breakdown.
        tx({ type: "income", category: "Salary", amount: 5000 }),
      ],
      period,
    );

    expect(slices[0]).toMatchObject({ category: "Groceries", amount: 100 });
    expect(slices[0].share).toBeCloseTo(0.714, 2);
    expect(slices.map((s) => s.category)).not.toContain("Salary");
  });

  it("returns nothing when there is no spend", () => {
    expect(spendByCategory([], resolvePeriod("month", NOW))).toEqual([]);
  });
});

describe("csv export", () => {
  it("escapes quotes and commas in notes", () => {
    const csv = transactionsToCsv([tx({ note: 'lunch, with "friends"', amount: 12.5 })]);
    expect(csv.split("\n")[0]).toBe("Date,Type,Amount,Category,Note");
    expect(csv).toContain('"lunch, with ""friends"""');
    expect(csv).toContain("12.50");
  });
});
