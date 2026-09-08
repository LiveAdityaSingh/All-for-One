// Vanessa's numbers (build spec §8). The primary loop is updating account
// balances, roughly weekly - one number per account. Runway is derived
// from how those balances move, never from logged expenses, because
// expense logging is explicitly optional texture and anything built on it
// would quietly mislead the moment the user stopped logging.
import { db } from "./db";
import { nanoid } from "./id";
import type { Account, BalanceSnapshot } from "./types";

// The balance loop is weekly, so a number older than a week is no longer
// something to state confidently.
export const STALE_AFTER_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysSince(iso: string, now: Date = new Date()): number {
  return (now.getTime() - new Date(iso).getTime()) / DAY_MS;
}

export function isStale(account: Account, now: Date = new Date()): boolean {
  return daysSince(account.updatedAt, now) >= STALE_AFTER_DAYS;
}

export type RunwayState =
  // Enough history, balances fresh - the number can be stated plainly.
  | "ok"
  // Balances are going up; there is no burn to divide by.
  | "growing"
  // Fewer than two readings far enough apart to infer a burn rate.
  | "insufficient_history"
  // A real number exists but rests on inputs that have aged out. Acting on
  // a three-week-old balance destroys trust in one shot, so this is shown
  // desaturated and labelled rather than stated as fact.
  | "stale"
  | "no_accounts";

export interface Runway {
  state: RunwayState;
  totalBalance: number;
  monthlyBurn: number | null;
  months: number | null;
  staleAccounts: string[];
  // How much history the estimate rests on, so the UI can be honest about
  // how provisional it is.
  daysOfHistory: number;
}

// At least a week of history before claiming to know a burn rate; below
// that a single unusual week would dominate the estimate.
const MIN_HISTORY_DAYS = 7;

export function computeRunway(
  accounts: Account[],
  snapshots: BalanceSnapshot[],
  now: Date = new Date(),
): Runway {
  const staleAccounts = accounts.filter((a) => isStale(a, now)).map((a) => a.name);
  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  if (accounts.length === 0) {
    return {
      state: "no_accounts",
      totalBalance: 0,
      monthlyBurn: null,
      months: null,
      staleAccounts,
      daysOfHistory: 0,
    };
  }

  // Earliest reading per account, so accounts added later don't look like
  // a sudden windfall that cancels out real spending.
  const earliestByAccount = new Map<string, BalanceSnapshot>();
  for (const snapshot of snapshots) {
    const held = earliestByAccount.get(snapshot.accountId);
    if (!held || new Date(snapshot.recordedAt) < new Date(held.recordedAt)) {
      earliestByAccount.set(snapshot.accountId, snapshot);
    }
  }

  const tracked = accounts.filter((a) => earliestByAccount.has(a.id));
  const oldest = [...earliestByAccount.values()].reduce<BalanceSnapshot | null>(
    (min, s) => (!min || new Date(s.recordedAt) < new Date(min.recordedAt) ? s : min),
    null,
  );

  const daysOfHistory = oldest ? daysSince(oldest.recordedAt, now) : 0;

  if (tracked.length === 0 || daysOfHistory < MIN_HISTORY_DAYS) {
    return {
      state: "insufficient_history",
      totalBalance,
      monthlyBurn: null,
      months: null,
      staleAccounts,
      daysOfHistory,
    };
  }

  const startingTotal = tracked.reduce(
    (sum, a) => sum + (earliestByAccount.get(a.id)?.balance ?? 0),
    0,
  );
  const currentTotal = tracked.reduce((sum, a) => sum + a.balance, 0);
  const decline = startingTotal - currentTotal;
  const monthlyBurn = (decline / daysOfHistory) * 30;

  if (monthlyBurn <= 0) {
    return {
      state: "growing",
      totalBalance,
      monthlyBurn,
      months: null,
      staleAccounts,
      daysOfHistory,
    };
  }

  return {
    state: staleAccounts.length > 0 ? "stale" : "ok",
    totalBalance,
    monthlyBurn,
    months: totalBalance / monthlyBurn,
    staleAccounts,
    daysOfHistory,
  };
}

export async function addAccount(name: string, goal: string, balance: number): Promise<void> {
  const now = new Date().toISOString();
  const id = nanoid();
  await db.accounts.add({
    id,
    name: name.trim(),
    goal: goal.trim(),
    balance,
    currency: "GBP",
    updatedAt: now,
    createdAt: now,
  });
  await db.balanceSnapshots.add({ id: nanoid(), accountId: id, balance, recordedAt: now });
}

// The primary loop: one number, per account, about weekly. Every update
// also lands in the history that runway is inferred from.
export interface BalanceChange {
  accountId: string;
  previousBalance: number;
  previousUpdatedAt: string;
  snapshotId: string;
}

export async function updateBalance(
  accountId: string,
  balance: number,
): Promise<BalanceChange | null> {
  const account = await db.accounts.get(accountId);
  if (!account) return null;

  const now = new Date().toISOString();
  const snapshotId = nanoid();
  await db.accounts.put({ ...account, balance, updatedAt: now });
  await db.balanceSnapshots.add({ id: snapshotId, accountId, balance, recordedAt: now });

  // Everything an undo needs to put this back exactly as it was.
  return {
    accountId,
    previousBalance: account.balance,
    previousUpdatedAt: account.updatedAt,
    snapshotId,
  };
}

// Reverses a balance update, including the history entry it wrote - leaving
// the snapshot behind would keep skewing the burn rate runway is built on.
export async function revertBalance(change: BalanceChange): Promise<void> {
  await db.transaction("rw", db.accounts, db.balanceSnapshots, async () => {
    const account = await db.accounts.get(change.accountId);
    if (account) {
      await db.accounts.put({
        ...account,
        balance: change.previousBalance,
        updatedAt: change.previousUpdatedAt,
      });
    }
    await db.balanceSnapshots.delete(change.snapshotId);
  });
}

export async function anyAccountStale(now: Date = new Date()): Promise<boolean> {
  const accounts = await db.accounts.toArray();
  return accounts.some((a) => isStale(a, now));
}

// Removing an account, and deciding what that means for what referenced it.
//
// An account was the one record you could create and never remove, so a
// mis-typed one was permanent. Deleting it has to answer two questions
// about the records pointing at it, and the answers are different:
//
// Transactions are kept. "£24 at Asda" happened whether or not you still
// track the card it came from, and deleting spending history to tidy up an
// account would quietly rewrite what you spent. They are unlinked instead.
//
// Balance snapshots are deleted. They are readings of this account and
// mean nothing without it - left behind they would go on feeding a runway
// figure for money that is no longer being tracked.
export async function deleteAccount(id: string): Promise<void> {
  await db.transaction(
    "rw",
    db.accounts,
    db.balanceSnapshots,
    db.transactions,
    db.deletions,
    async () => {
      const deletedAt = new Date().toISOString();

      const snapshots = await db.balanceSnapshots.where("accountId").equals(id).toArray();
      for (const snapshot of snapshots) {
        await db.balanceSnapshots.delete(snapshot.id);
        await db.deletions.put({ id: snapshot.id, table: "balanceSnapshots", deletedAt });
      }

      const linked = await db.transactions.where("accountId").equals(id).toArray();
      for (const transaction of linked) {
        await db.transactions.update(transaction.id, { accountId: null });
      }

      await db.accounts.delete(id);
      await db.deletions.put({ id, table: "accounts", deletedAt });
    },
  );
}
