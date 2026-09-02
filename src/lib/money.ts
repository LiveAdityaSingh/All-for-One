// Period rollups for the transactions-first finance screen: the
// income/expenses/net header, the category breakdown and the transaction
// list all read the same selected window.
import { db } from "./db";
import { nanoid } from "./id";
import type { Transaction, TransactionType } from "./types";

export type PeriodKey = "today" | "week" | "month" | "custom";

export interface Period {
  from: Date;
  to: Date;
}

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  custom: "Custom",
};

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function resolvePeriod(
  key: PeriodKey,
  now: Date = new Date(),
  custom?: Period,
): Period {
  const to = new Date(now);

  if (key === "custom" && custom) return custom;

  if (key === "today") return { from: startOfDay(now), to };

  if (key === "week") {
    const from = startOfDay(now);
    // Weeks start Monday: getDay() is 0 for Sunday, which is 6 days in.
    const offset = (from.getDay() + 6) % 7;
    from.setDate(from.getDate() - offset);
    return { from, to };
  }

  const from = startOfDay(now);
  from.setDate(1);
  return { from, to };
}

export function inPeriod(transaction: Transaction, period: Period): boolean {
  const t = new Date(transaction.occurredAt).getTime();
  return t >= period.from.getTime() && t <= period.to.getTime();
}

export interface Totals {
  income: number;
  expenses: number;
  net: number;
}

export function totalsFor(transactions: Transaction[], period: Period): Totals {
  let income = 0;
  let expenses = 0;

  for (const transaction of transactions) {
    if (!inPeriod(transaction, period)) continue;
    if (transaction.type === "income") income += transaction.amount;
    else expenses += transaction.amount;
  }

  return { income, expenses, net: income - expenses };
}

export interface CategorySlice {
  category: string;
  amount: number;
  share: number; // 0-1 of total spend in the period
}

export function spendByCategory(
  transactions: Transaction[],
  period: Period,
): CategorySlice[] {
  const totals = new Map<string, number>();
  let total = 0;

  for (const transaction of transactions) {
    if (transaction.type !== "expense" || !inPeriod(transaction, period)) continue;
    totals.set(transaction.category, (totals.get(transaction.category) ?? 0) + transaction.amount);
    total += transaction.amount;
  }

  return [...totals.entries()]
    .map(([category, amount]) => ({
      category,
      amount,
      share: total > 0 ? amount / total : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

// Signed effect a transaction has on the account it was paid from.
function balanceDelta(type: TransactionType, amount: number): number {
  return type === "income" ? amount : -amount;
}

// Money named against an account moves that account's balance. Note that
// `updatedAt` is deliberately left alone: it records the last balance the
// user actually confirmed against their bank, and a balance inferred from
// logged transactions is not that - manual logs are always incomplete, so
// the account should still prompt for a real reading.
async function adjustBalance(accountId: string | null, delta: number): Promise<void> {
  if (!accountId || delta === 0) return;
  const account = await db.accounts.get(accountId);
  if (!account) return;
  await db.accounts.put({
    ...account,
    balance: Number((account.balance + delta).toFixed(2)),
  });
}

export async function addTransaction(
  type: TransactionType,
  amount: number,
  category: string,
  note: string,
  accountId: string | null = null,
  occurredAt: Date = new Date(),
): Promise<string> {
  const id = nanoid();
  await db.transaction("rw", db.transactions, db.accounts, async () => {
    await db.transactions.add({
      id,
      type,
      amount,
      category,
      accountId,
      note,
      occurredAt: occurredAt.toISOString(),
    });
    await adjustBalance(accountId, balanceDelta(type, amount));
  });
  return id;
}

// Removing a transaction has to undo what it did to the balance, or the
// account drifts further from reality with every correction.
export async function deleteTransaction(id: string): Promise<void> {
  await db.transaction("rw", db.transactions, db.accounts, db.deletions, async () => {
    const transaction = await db.transactions.get(id);
    if (!transaction) return;
    await db.transactions.delete(id);
    // A tombstone, so the deletion can travel to another device instead of
    // being silently undone by the next import.
    await db.deletions.put({
      id,
      table: "transactions",
      deletedAt: new Date().toISOString(),
    });
    await adjustBalance(
      transaction.accountId,
      -balanceDelta(transaction.type, transaction.amount),
    );
  });
}

// --- Monthly limit --------------------------------------------------------

const MONTHLY_LIMIT_KEY = "monthlyLimit";

export async function getMonthlyLimit(): Promise<number> {
  const row = await db.settings.get(MONTHLY_LIMIT_KEY);
  const value = Number(row?.value ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export async function setMonthlyLimit(value: number): Promise<void> {
  await db.settings.put({ key: MONTHLY_LIMIT_KEY, value: String(value) });
}

// --- Export ---------------------------------------------------------------

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// Pairs with Tony's CSV import: the user's data can always leave again.
export function transactionsToCsv(transactions: Transaction[]): string {
  const header = ["Date", "Type", "Amount", "Category", "Note"];
  const rows = transactions.map((t) => [
    new Date(t.occurredAt).toISOString().slice(0, 10),
    t.type,
    t.amount.toFixed(2),
    t.category,
    t.note,
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}
