// The one body record. Read and written through here so the constant id
// never has to be remembered at a call site.
import { db } from "./db";
import { PROFILE_ID, type BodyMetrics, type Sex } from "./types";

export async function getBodyMetrics(): Promise<BodyMetrics | undefined> {
  return db.bodyMetrics.get(PROFILE_ID);
}

export interface MetricsInput {
  heightCm: number | null;
  weightKg: number | null;
  birthYear: number | null;
  sex: Sex;
}

export async function saveBodyMetrics(input: MetricsInput): Promise<void> {
  await db.bodyMetrics.put({
    id: PROFILE_ID,
    ...input,
    updatedAt: new Date().toISOString(),
  });
}

// Ranges wide enough for any adult and narrow enough to catch a slipped
// decimal point, which is the realistic error on a phone keyboard.
export function cleanNumber(raw: string, min: number, max: number): number | null {
  const value = Number(raw.trim());
  if (!Number.isFinite(value) || value < min || value > max) return null;
  return Math.round(value * 10) / 10;
}

export function ageFrom(birthYear: number | null, now: Date = new Date()): number | null {
  if (!birthYear) return null;
  const age = now.getFullYear() - birthYear;
  return age >= 0 && age < 130 ? age : null;
}
