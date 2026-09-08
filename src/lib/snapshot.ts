// Automatic on-device backups.
//
// The premise of this app is that your data lives only on your device, and
// Settings reports the flaw in that plainly: storage.persist() is refused,
// so the browser's IndexedDB is evictable when the phone runs short of
// space. Everything you have logged can be cleared by the system without
// asking, and the only safety net is an export you have to remember.
//
// The installed app can do better, because app-private files are not
// browser storage and are not subject to that eviction. A snapshot is
// written once a day into the app's own directory, so the worst a wipe of
// the WebView's storage can cost is a day.
import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { buildBackup, parseBackup, restoreBackup, type Backup } from "./backup";

const DIR = "snapshots";
const PREFIX = "all-for-one-";
const DAY_MS = 24 * 60 * 60 * 1000;

// Enough to survive a bad week without the data ever being large: these
// are JSON records, not media.
export const KEEP = 7;

export interface SnapshotInfo {
  name: string;
  takenAt: Date;
}

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

function nameFor(at: Date): string {
  return `${PREFIX}${at.toISOString().replace(/[:.]/g, "-")}.json`;
}

export function takenAtFrom(name: string): Date | null {
  if (!name.startsWith(PREFIX) || !name.endsWith(".json")) return null;
  const stamp = name.slice(PREFIX.length, -".json".length);
  // Undo the filename-safe substitutions: 2026-09-08T20-07-00-000Z.
  const iso = stamp.replace(
    /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/,
    "$1T$2:$3:$4.$5Z",
  );
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function ensureDir(): Promise<void> {
  try {
    await Filesystem.mkdir({ path: DIR, directory: Directory.Data, recursive: true });
  } catch {
    // Already there, which is the usual case.
  }
}

export async function listSnapshots(): Promise<SnapshotInfo[]> {
  if (!isNative()) return [];
  try {
    const { files } = await Filesystem.readdir({ path: DIR, directory: Directory.Data });
    return files
      .map((f) => ({ name: f.name, takenAt: takenAtFrom(f.name) }))
      .filter((f): f is SnapshotInfo => f.takenAt !== null)
      .sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime());
  } catch {
    return [];
  }
}

// Decides whether today's snapshot is still owed. Pure, so the rule can be
// tested without a filesystem.
export function isSnapshotDue(
  existing: SnapshotInfo[],
  now: Date = new Date(),
  everyMs: number = DAY_MS,
): boolean {
  const newest = existing[0];
  if (!newest) return true;
  return now.getTime() - newest.takenAt.getTime() >= everyMs;
}

export function toPrune(existing: SnapshotInfo[], keep: number = KEEP): SnapshotInfo[] {
  return existing.slice(keep);
}

export async function writeSnapshot(now: Date = new Date()): Promise<SnapshotInfo | null> {
  if (!isNative()) return null;

  try {
    await ensureDir();
    const backup = await buildBackup();
    const name = nameFor(now);

    await Filesystem.writeFile({
      path: `${DIR}/${name}`,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
      data: JSON.stringify(backup),
    });

    for (const old of toPrune(await listSnapshots())) {
      await Filesystem.deleteFile({
        path: `${DIR}/${old.name}`,
        directory: Directory.Data,
      }).catch(() => {});
    }

    return { name, takenAt: now };
  } catch {
    // A failed snapshot must never break the launch that triggered it.
    return null;
  }
}

// Called on every launch. Cheap when nothing is owed, which is most of
// the time.
export async function snapshotIfDue(now: Date = new Date()): Promise<SnapshotInfo | null> {
  if (!isNative()) return null;
  const existing = await listSnapshots();
  if (!isSnapshotDue(existing, now)) return existing[0] ?? null;
  return writeSnapshot(now);
}

export async function readSnapshot(name: string): Promise<Backup | null> {
  if (!isNative()) return null;
  try {
    const { data } = await Filesystem.readFile({
      path: `${DIR}/${name}`,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    return parseBackup(typeof data === "string" ? data : "");
  } catch {
    return null;
  }
}

// Replaces everything with the snapshot, the same way importing a file
// does - this is a recovery path, not a merge.
export async function restoreSnapshot(name: string): Promise<boolean> {
  const backup = await readSnapshot(name);
  if (!backup) return false;
  await restoreBackup(backup);
  return true;
}
