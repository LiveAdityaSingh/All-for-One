import Dexie, { type EntityTable } from "dexie";
import type {
  Account,
  BodyMetrics,
  BalanceSnapshot,
  Capture,
  JobApplication,
  Setting,
  Transaction,
  CvVariant,
  Claim,
  Deletion,
  Task,
} from "./types";

// Local-first storage (build spec §13): everything lives on-device in
// IndexedDB. No server round-trip to read or write application data.
//
// Anything used as an orderBy() key has to appear in the index list below:
// Dexie throws SchemaError on an unindexed sort key rather than quietly
// falling back to an in-memory sort.
// Every id-keyed table that participates in export, import and deletion
// tracking. `settings` is excluded: it is keyed by name, is device-local
// (API keys, locale) and should not travel between devices.
export const SYNCED_TABLES = [
  "applications",
  "cvVariants",
  "claims",
  "captures",
  "tasks",
  "accounts",
  "balanceSnapshots",
  "transactions",
  "bodyMetrics",
] as const;

export type SyncedTable = (typeof SYNCED_TABLES)[number];

class AppDatabase extends Dexie {
  applications!: EntityTable<JobApplication, "id">;
  cvVariants!: EntityTable<CvVariant, "id">;
  claims!: EntityTable<Claim, "id">;
  captures!: EntityTable<Capture, "id">;
  tasks!: EntityTable<Task, "id">;
  accounts!: EntityTable<Account, "id">;
  balanceSnapshots!: EntityTable<BalanceSnapshot, "id">;
  transactions!: EntityTable<Transaction, "id">;
  bodyMetrics!: EntityTable<BodyMetrics, "id">;
  settings!: EntityTable<Setting, "key">;
  deletions!: EntityTable<Deletion, "id">;

  constructor() {
    super("all-for-one");
    this.version(1).stores({
      applications: "id, company, stage, lifecycleStatus, stageEnteredAt",
      cvVariants: "id, name",
      claims: "id, confirmed",
    });
    this.version(2).stores({
      captures: "id, kind, agent, capturedAt",
    });
    this.version(3)
      .stores({ tasks: "id, kind, dueAt, completedAt, createdAt" })
      .upgrade(async (tx) => {
        // Before Lisa had a surface of her own, spoken reminders were
        // parked in `captures`. They become real tasks here so nothing a
        // user already captured silently disappears from the app.
        const events = await tx.table("captures").where("kind").equals("event").toArray();
        if (events.length === 0) return;

        await tx.table("tasks").bulkAdd(
          events.map((capture: Capture) => ({
            id: capture.id,
            title: capture.label,
            kind: "one_off" as const,
            dueAt: capture.scheduledFor ?? null,
            completedAt: null,
            lastCompletedOn: null,
            createdAt: capture.capturedAt,
          })),
        );
        await tx.table("captures").bulkDelete(events.map((c: Capture) => c.id));
      });
    this.version(4).stores({
      accounts: "id, name, updatedAt",
      balanceSnapshots: "id, accountId, recordedAt",
    });
    this.version(5)
      .stores({
        transactions: "id, type, category, accountId, occurredAt",
        settings: "key",
      })
      .upgrade(async (tx) => {
        // Expenses were previously loose captures. The finance screen is
        // transactions-first now, so they become real records rather than
        // being stranded in a list nothing reads.
        const spend = await tx.table("captures").where("kind").equals("expense").toArray();
        if (spend.length === 0) return;

        await tx.table("transactions").bulkAdd(
          spend.map((capture: Capture) => ({
            id: capture.id,
            type: "expense" as const,
            amount: capture.amount ?? 0,
            category: capture.label || "Other",
            accountId: null,
            note: capture.raw,
            occurredAt: capture.capturedAt,
          })),
        );
        await tx.table("captures").bulkDelete(spend.map((c: Capture) => c.id));
      });
    this.version(6).stores({
      // Tombstones, so a delete can travel between devices the way a
      // create does. Keyed by the deleted record's own id.
      deletions: "id, table, deletedAt",
      // modifiedAt is indexed on the tables an export walks most often.
      applications: "id, company, stage, lifecycleStatus, stageEnteredAt, modifiedAt",
      transactions: "id, type, category, accountId, occurredAt, modifiedAt",
      tasks: "id, kind, dueAt, completedAt, createdAt, modifiedAt",
    });

    this.version(7).stores({
      // One row, keyed by a constant: there is one body being described,
      // not a series of measurements.
      bodyMetrics: "id, updatedAt",
    });

    // Stamp every write, on every table, without touching call sites -
    // a hook cannot be forgotten the way a manual assignment can.
    for (const name of SYNCED_TABLES) {
      // Dexie's typed hook overloads are per-entity; this loop is
      // deliberately generic across every table, so the shape is narrowed
      // to just the two hooks used here.
      const table = this.table(name) as unknown as {
        hook(
          event: "creating",
          fn: (pk: unknown, obj: Record<string, unknown>) => void,
        ): void;
        hook(
          event: "updating",
          fn: (mods: Record<string, unknown>) => Record<string, unknown>,
        ): void;
      };

      table.hook("creating", (_pk, obj) => {
        if (!obj.modifiedAt) obj.modifiedAt = new Date().toISOString();
      });

      table.hook("updating", (mods) => {
        // A no-op update should not look like a change to a syncing peer.
        if (Object.keys(mods).length === 0) return mods;
        return { ...mods, modifiedAt: new Date().toISOString() };
      });
    }
  }
}

export const db = new AppDatabase();
