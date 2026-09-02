// Getting data off one device and onto another, and getting it back if the
// browser throws it away.
//
// This app has no server by design (build spec §13), which means the browser
// is the only copy. Browser storage is also the most volatile place data can
// live: it is evictable under pressure, "clear site data" wipes it, and each
// device is a separate database. So a file the user holds is not a nice
// extra here - it is the only recovery path and the only way to move between
// a phone and a laptop.
import { db, SYNCED_TABLES, type SyncedTable } from "./db";
import type { Deletion } from "./types";

// Bumped only when the shape below changes incompatibly, so an old file can
// be recognised and refused rather than half-imported.
const BACKUP_VERSION = 1;

export interface Backup {
  format: "all-for-one-backup";
  version: number;
  exportedAt: string;
  records: Record<string, unknown[]>;
  deletions: Deletion[];
}

export interface BackupSummary {
  counts: Record<string, number>;
  total: number;
}

export async function buildBackup(): Promise<Backup> {
  const records: Record<string, unknown[]> = {};
  for (const table of SYNCED_TABLES) {
    records[table] = await db.table(table).toArray();
  }

  return {
    format: "all-for-one-backup",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    records,
    // Tombstones travel too: without them an import would resurrect
    // everything the user deleted on the other device.
    deletions: await db.deletions.toArray(),
  };
}

export function summarise(backup: Backup): BackupSummary {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const [table, rows] of Object.entries(backup.records)) {
    counts[table] = rows.length;
    total += rows.length;
  }
  return { counts, total };
}

// Deliberately strict: a malformed or foreign file should be refused before
// it touches the database, not discovered halfway through restoring.
export function parseBackup(text: string): Backup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }

  const candidate = parsed as Partial<Backup>;
  if (candidate?.format !== "all-for-one-backup") {
    throw new Error("That doesn't look like an All for One backup.");
  }
  if (typeof candidate.version !== "number" || candidate.version > BACKUP_VERSION) {
    throw new Error(
      `That backup was made by a newer version of the app (v${candidate.version}).`,
    );
  }
  if (!candidate.records || typeof candidate.records !== "object") {
    throw new Error("That backup has no records in it.");
  }

  for (const table of Object.keys(candidate.records)) {
    if (!SYNCED_TABLES.includes(table as SyncedTable)) {
      throw new Error(`That backup contains an unknown table: ${table}.`);
    }
    if (!Array.isArray(candidate.records[table])) {
      throw new Error(`The ${table} section of that backup is malformed.`);
    }
  }

  return {
    format: "all-for-one-backup",
    version: candidate.version,
    exportedAt: candidate.exportedAt ?? new Date().toISOString(),
    records: candidate.records as Record<string, unknown[]>,
    deletions: Array.isArray(candidate.deletions) ? candidate.deletions : [],
  };
}

// Replace, not merge. Merging needs a rule for "both sides changed this
// record", and until sync exists there is no honest answer to that - so the
// semantics stay predictable: what you import is what you get.
export async function restoreBackup(backup: Backup): Promise<BackupSummary> {
  const tables = [...SYNCED_TABLES.map((t) => db.table(t)), db.deletions];

  await db.transaction("rw", tables, async () => {
    for (const table of SYNCED_TABLES) {
      await db.table(table).clear();
      const rows = backup.records[table];
      if (rows?.length) await db.table(table).bulkPut(rows);
    }
    await db.deletions.clear();
    if (backup.deletions.length) await db.deletions.bulkPut(backup.deletions);
  });

  return summarise(backup);
}

// A delete that leaves a trace, in one transaction so a crash can never
// remove the record while losing the tombstone.
export async function softDelete(table: SyncedTable, id: string): Promise<void> {
  await db.transaction("rw", db.table(table), db.deletions, async () => {
    await db.table(table).delete(id);
    await db.deletions.put({ id, table, deletedAt: new Date().toISOString() });
  });
}

export function backupFilename(now: Date = new Date()): string {
  const stamp = now.toISOString().slice(0, 10);
  return `all-for-one-${stamp}.json`;
}
