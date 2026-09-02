import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";
import {
  buildBackup,
  parseBackup,
  restoreBackup,
  softDelete,
  summarise,
} from "./backup";
import { addTask } from "./tasks";
import { addAccount } from "./finance";
import { addTransaction, deleteTransaction } from "./money";
import { captureUtterance, undoCapture } from "./capture";

// This file is the only recovery path for an app with no server, so a
// silent failure here loses everything the user has.

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("round trip", () => {
  it("restores every table exactly", async () => {
    await addTask("Call the plumber", "one_off", new Date("2026-09-04T17:00:00"));
    await addAccount("Lloyds", "Salary", 992.48);
    const [account] = await db.accounts.toArray();
    // Linked to the account, so the restore also has to preserve the
    // balance the transaction moved.
    await addTransaction("expense", 24, "Groceries", "spent 24 at asda", account.id);

    const backup = await buildBackup();
    expect(summarise(backup).total).toBe(4); // task, account, snapshot, transaction

    await db.delete();
    await db.open();
    expect(await db.tasks.count()).toBe(0);

    await restoreBackup(backup);

    expect(await db.tasks.count()).toBe(1);
    expect(await db.accounts.count()).toBe(1);
    expect(await db.transactions.count()).toBe(1);
    expect((await db.accounts.toArray())[0].balance).toBe(968.48);
  });

  it("survives a JSON round trip through a file", async () => {
    await addTask("Morning run", "daily", null);
    const text = JSON.stringify(await buildBackup());

    await db.delete();
    await db.open();
    await restoreBackup(parseBackup(text));

    expect((await db.tasks.toArray())[0].title).toBe("Morning run");
  });

  it("replaces rather than merges, so an import is predictable", async () => {
    await addTask("From the phone", "one_off", null);
    const backup = await buildBackup();

    await db.tasks.clear();
    await addTask("From the laptop", "one_off", null);
    await restoreBackup(backup);

    const titles = (await db.tasks.toArray()).map((t) => t.title);
    expect(titles).toEqual(["From the phone"]);
  });
});

describe("modifiedAt stamping", () => {
  it("stamps on create without any call site asking", async () => {
    await addTask("Buy milk", "one_off", null);
    expect((await db.tasks.toArray())[0].modifiedAt).toBeTruthy();
  });

  it("moves forward on update", async () => {
    await addTask("Buy milk", "one_off", null);
    const before = (await db.tasks.toArray())[0];

    await new Promise((r) => setTimeout(r, 5));
    await db.tasks.update(before.id, { title: "Buy oat milk" });

    const after = (await db.tasks.toArray())[0];
    expect(after.modifiedAt! > before.modifiedAt!).toBe(true);
  });
});

describe("deletions leave a tombstone", () => {
  it("records what was removed and from where", async () => {
    await addTask("Temporary", "one_off", null);
    const task = (await db.tasks.toArray())[0];

    await softDelete("tasks", task.id);

    expect(await db.tasks.count()).toBe(0);
    const [tombstone] = await db.deletions.toArray();
    expect(tombstone).toMatchObject({ id: task.id, table: "tasks" });
  });

  it("tombstones a deleted transaction too", async () => {
    await addTransaction("expense", 10, "Other", "", null);
    const [tx] = await db.transactions.toArray();

    await deleteTransaction(tx.id);

    expect((await db.deletions.toArray())[0]).toMatchObject({
      id: tx.id,
      table: "transactions",
    });
  });

  it("carries tombstones through export and import", async () => {
    // Without this a restore would resurrect everything the user deleted.
    await addTask("Deleted on the phone", "one_off", null);
    const task = (await db.tasks.toArray())[0];
    await softDelete("tasks", task.id);

    const backup = await buildBackup();
    expect(backup.deletions).toHaveLength(1);

    await db.delete();
    await db.open();
    await restoreBackup(backup);

    expect(await db.deletions.count()).toBe(1);
    expect(await db.tasks.count()).toBe(0);
  });
});

describe("refusing bad files", () => {
  it("rejects text that is not JSON", () => {
    expect(() => parseBackup("not json at all")).toThrow(/valid JSON/);
  });

  it("rejects JSON that is not one of our backups", () => {
    expect(() => parseBackup('{"hello":"world"}')).toThrow(/All for One backup/);
  });

  it("rejects a backup from a newer app version", () => {
    expect(() =>
      parseBackup('{"format":"all-for-one-backup","version":99,"records":{}}'),
    ).toThrow(/newer version/);
  });

  it("rejects a file naming a table we do not have", () => {
    expect(() =>
      parseBackup(
        '{"format":"all-for-one-backup","version":1,"records":{"secrets":[]}}',
      ),
    ).toThrow(/unknown table/);
  });

  it("rejects a malformed table section", () => {
    expect(() =>
      parseBackup(
        '{"format":"all-for-one-backup","version":1,"records":{"tasks":"nope"}}',
      ),
    ).toThrow(/malformed/);
  });
});

describe("undoing a capture", () => {
  it("removes an application and leaves nothing behind", async () => {
    const outcome = await captureUtterance("applied to Globex for Backend Engineer");
    expect(await db.applications.count()).toBe(1);

    await undoCapture(outcome.undo!);
    expect(await db.applications.count()).toBe(0);
  });

  it("reverses a spend, including the balance it moved", async () => {
    await addAccount("Lloyds", "Salary", 1000);
    const [account] = await db.accounts.toArray();

    const outcome = await captureUtterance("spent 24 quid on groceries, Lloyds");
    expect((await db.accounts.get(account.id))!.balance).toBe(976);

    await undoCapture(outcome.undo!);
    expect(await db.transactions.count()).toBe(0);
    expect((await db.accounts.get(account.id))!.balance).toBe(1000);
  });

  it("restores the previous balance AND drops the snapshot", async () => {
    // Leaving the snapshot behind would keep skewing the burn rate that
    // runway is derived from, long after the capture was undone.
    await addAccount("Lloyds", "Salary", 1000);
    const [account] = await db.accounts.toArray();
    const snapshotsBefore = await db.balanceSnapshots.count();

    const outcome = await captureUtterance("lloyds is 2500");
    expect((await db.accounts.get(account.id))!.balance).toBe(2500);
    expect(await db.balanceSnapshots.count()).toBe(snapshotsBefore + 1);

    await undoCapture(outcome.undo!);
    const restored = (await db.accounts.get(account.id))!;
    expect(restored.balance).toBe(1000);
    expect(restored.updatedAt).toBe(account.updatedAt);
    expect(await db.balanceSnapshots.count()).toBe(snapshotsBefore);
  });

  it("removes a workout and a reminder", async () => {
    const workout = await captureUtterance("did 45 minutes legs");
    await undoCapture(workout.undo!);
    expect(await db.captures.count()).toBe(0);

    const reminder = await captureUtterance("remind me to call the plumber at 5pm");
    expect(await db.tasks.count()).toBe(1);
    await undoCapture(reminder.undo!);
    expect(await db.tasks.count()).toBe(0);
  });

  it("offers nothing to undo for a question", async () => {
    const outcome = await captureUtterance("what's my runway?");
    expect(outcome.undo).toBeUndefined();
  });
});
