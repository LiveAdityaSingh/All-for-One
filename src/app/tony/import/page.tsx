"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { db } from "@/lib/db";
import { importApplicationsFromCsv } from "@/lib/csv-import";

export default function ImportPage() {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const { applications, skippedRows } = importApplicationsFromCsv(text);

    await db.applications.bulkAdd(applications);

    setStatus(
      `Imported ${applications.length} application${applications.length === 1 ? "" : "s"}` +
        (skippedRows > 0 ? `, skipped ${skippedRows} row${skippedRows === 1 ? "" : "s"} missing company/role.` : "."),
    );

    if (applications.length > 0) {
      window.setTimeout(() => router.push("/tony"), 1200);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4">
      <h1 className="text-lg font-semibold" style={{ color: "var(--color-tony)" }}>
        Import from CSV
      </h1>
      <p className="text-sm text-foreground-muted">
        Accepts columns named Company, Role/Title, Stage/Status, Applied Date, and Notes -
        in any order, matching common spreadsheet or Notion exports.
      </p>
      <input type="file" accept=".csv,text/csv" onChange={handleFile} className="text-sm" />
      {status && <p className="text-sm">{status}</p>}
    </div>
  );
}
