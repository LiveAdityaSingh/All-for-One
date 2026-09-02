import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";
import { addAccount } from "./finance";
import { addTransaction, deleteTransaction } from "./money";

// Logging money against an account has to move that account's balance, and
// removing the entry has to move it back. Without the reversal every
// correction leaves the balance a little further from reality.

async function seedAccount(balance: number): Promise<string> {
  await addAccount("Lloyds", "Salary account", balance);
  const account = (await db.accounts.toArray())[0];
  return account.id;
}

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("transactions move the account balance", () => {
  it("subtracts an expense", async () => {
    const id = await seedAccount(992.48);
    await addTransaction("expense", 24, "Groceries", "spent 24 at asda", id);

    expect((await db.accounts.get(id))!.balance).toBe(968.48);
  });

  it("adds income", async () => {
    const id = await seedAccount(100);
    await addTransaction("income", 991, "Income", "income 991", id);

    expect((await db.accounts.get(id))!.balance).toBe(1091);
  });

  it("leaves the balance alone when no account was named", async () => {
    const id = await seedAccount(500);
    await addTransaction("expense", 24, "Other", "spent 24", null);

    expect((await db.accounts.get(id))!.balance).toBe(500);
  });

  it("reverses the adjustment when a transaction is deleted", async () => {
    const id = await seedAccount(1000);
    await addTransaction("expense", 24, "Groceries", "", id);
    const [tx] = await db.transactions.toArray();

    await deleteTransaction(tx.id);

    expect((await db.accounts.get(id))!.balance).toBe(1000);
    expect(await db.transactions.count()).toBe(0);
  });

  it("returns to the starting balance after many add/delete cycles", async () => {
    const id = await seedAccount(1000);
    for (let i = 0; i < 8; i++) {
      await addTransaction("expense", 12.34, "Eating out", "", id);
    }
    for (const tx of await db.transactions.toArray()) {
      await deleteTransaction(tx.id);
    }

    // Rounding must not accumulate across repeated adjustments.
    expect((await db.accounts.get(id))!.balance).toBe(1000);
  });

  it("does not mark the balance as freshly confirmed", async () => {
    // A balance inferred from logged spending is not a reading from the
    // bank, so the account should still ask to be reconciled.
    const id = await seedAccount(500);
    const before = (await db.accounts.get(id))!.updatedAt;

    await addTransaction("expense", 10, "Other", "", id);

    expect((await db.accounts.get(id))!.updatedAt).toBe(before);
  });
});
