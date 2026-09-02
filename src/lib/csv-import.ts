import { nanoid } from "./id";
import type { ApplicationStage, JobApplication } from "./types";

// CSV import (build spec §6, "non-negotiable"). Accepts a generic header
// row so exports from a spreadsheet or Notion database both work, rather
// than locking users into one tool's column names.
const HEADER_ALIASES: Record<string, keyof ImportRow> = {
  company: "company",
  employer: "company",
  role: "role",
  title: "role",
  position: "role",
  stage: "stage",
  status: "stage",
  "applied date": "appliedAt",
  "date applied": "appliedAt",
  appliedat: "appliedAt",
  notes: "notes",
};

const STAGE_ALIASES: Record<string, ApplicationStage> = {
  applied: "applied",
  "recruiter screen": "recruiter_screen",
  screening: "recruiter_screen",
  interview: "interviewed",
  interviewed: "interviewed",
  "final stage": "final_stage",
  final: "final_stage",
  offer: "offer",
  rejected: "rejected",
  declined: "rejected",
  withdrawn: "withdrawn",
};

interface ImportRow {
  company: string;
  role: string;
  stage: string;
  appliedAt: string;
  notes: string;
}

export interface CsvImportResult {
  applications: JobApplication[];
  skippedRows: number;
}

function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, "")));
}

export function importApplicationsFromCsv(csvText: string): CsvImportResult {
  const rows = parseCsv(csvText);
  if (rows.length === 0) return { applications: [], skippedRows: 0 };

  const [headerRow, ...dataRows] = rows;
  const columnMap = headerRow.map(
    (header) => HEADER_ALIASES[header.toLowerCase().trim()] ?? null,
  );

  const applications: JobApplication[] = [];
  let skippedRows = 0;

  for (const row of dataRows) {
    const record: Partial<ImportRow> = {};
    columnMap.forEach((field, index) => {
      if (field) record[field] = row[index] ?? "";
    });

    if (!record.company || !record.role) {
      skippedRows++;
      continue;
    }

    const stage = STAGE_ALIASES[(record.stage ?? "applied").toLowerCase().trim()] ?? "applied";
    const appliedAt = record.appliedAt && !Number.isNaN(Date.parse(record.appliedAt))
      ? new Date(record.appliedAt).toISOString()
      : new Date().toISOString();

    applications.push({
      id: nanoid(),
      company: record.company,
      role: record.role,
      stage,
      lifecycleStatus: "active",
      cvVariantId: null,
      appliedAt,
      stageEnteredAt: appliedAt,
      lastNudgedAt: null,
      nudgesIgnored: 0,
      notes: record.notes ?? "",
    });
  }

  return { applications, skippedRows };
}
