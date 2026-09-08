import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";
import { addAccount, deleteAccount, updateBalance } from "./finance";
import { addTransaction } from "./money";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function seed() {
  await addAccount("Lloyds", "Current", 1200);
  const [account] = await db.accounts.toArray();
  // A snapshot exists from the moment the balance moves.
  await updateBalance(account.id, 1176);
  const spend = await addTransaction("expense", 24, "Groceries", "Asda", account.id);
  const unrelated = await addTransaction("expense", 9, "Eating out", "Pret", null);
  return { account, spend, unrelated };
}

describe("deleting an account", () => {
  it("removes the account and tombstones it", async () => {
    const { account } = await seed();
    await deleteAccount(account.id);

    expect(await db.accounts.get(account.id)).toBeUndefined();
    const tombstone = await db.deletions.get(account.id);
    expect(tombstone?.table).toBe("accounts");
  });

  // Spending happened whether or not the card is still tracked, so the
  // history stays and only the link goes.
  it("keeps the transactions and unlinks them", async () => {
    const { account, spend } = await seed();
    await deleteAccount(account.id);

    const kept = await db.transactions.get(spend);
    expect(kept).toBeDefined();
    expect(kept?.amount).toBe(24);
    expect(kept?.accountId).toBeNull();
  });

  it("leaves other accounts' transactions alone", async () => {
    const { account, unrelated } = await seed();
    await deleteAccount(account.id);
    expect((await db.transactions.get(unrelated))?.accountId).toBeNull();
    expect(await db.transactions.count()).toBe(2);
  });

  // Snapshots are readings of this account; left behind they would go on
  // feeding a runway figure for money nobody is tracking.
  it("deletes its balance snapshots, with tombstones", async () => {
    const { account } = await seed();
    const before = await db.balanceSnapshots.where("accountId").equals(account.id).count();
    expect(before).toBeGreaterThan(0);

    await deleteAccount(account.id);

    expect(await db.balanceSnapshots.where("accountId").equals(account.id).count()).toBe(0);
    const tombstones = await db.deletions.where("table").equals("balanceSnapshots").count();
    expect(tombstones).toBe(before);
  });

  it("does nothing surprising when the account has nothing attached", async () => {
    await addAccount("Empty", "", 0);
    const [account] = await db.accounts.toArray();
    await deleteAccount(account.id);
    expect(await db.accounts.count()).toBe(0);
  });
});
