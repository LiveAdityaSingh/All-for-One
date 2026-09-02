"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { db } from "@/lib/db";
import { tailorCvForJob, type TailoringResult } from "@/lib/cv-tailor";
import { STAGE_LABELS } from "@/lib/types";

function DetailContent() {
  const id = useSearchParams().get("id") ?? "";
  const application = useLiveQuery(() => db.applications.get(id), [id]);
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState<TailoringResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleTailor() {
    setLoading(true);
    setError(null);
    try {
      const allClaims = await db.claims.toArray();
      setResult(await tailorCvForJob(allClaims, jobDescription));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (!application) return <p className="px-4 text-sm text-foreground-muted">Loading...</p>;

  return (
    <div className="flex flex-col gap-4 px-4">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: "var(--color-tony)" }}>
          {application.company}
        </h1>
        <p className="text-sm text-foreground-muted">
          {application.role} - {STAGE_LABELS[application.stage]}
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Job description
        <textarea
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          rows={6}
          className="rounded-lg border border-border bg-background-elevated px-3 py-2 text-sm"
        />
      </label>

      <button
        onClick={handleTailor}
        disabled={loading || !jobDescription.trim()}
        className="rounded-full px-4 py-2 text-sm font-medium disabled:opacity-50"
        style={{ backgroundColor: "var(--color-tony)", color: "var(--background)" }}
      >
        {loading ? "Tailoring..." : "Suggest tweaks"}
      </button>

      {error && <p className="text-sm" style={{ color: "var(--color-overdue)" }}>{error}</p>}

      {result && (
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="text-sm font-semibold">Suggested bullets</h2>
            {result.suggestions.length === 0 && (
              <p className="text-sm text-foreground-muted">
                No confirmed claims matched closely enough to suggest anything.
              </p>
            )}
            <ul className="mt-1 flex flex-col gap-2">
              {result.suggestions.map((s, i) => (
                <li key={i} className="rounded-lg border border-border bg-background-elevated p-2 text-sm">
                  {s.bullet}
                </li>
              ))}
            </ul>
          </div>

          {result.gaps.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold">Gaps - nothing confirmed backs these</h2>
              <ul className="mt-1 flex flex-col gap-1">
                {result.gaps.map((gap, i) => (
                  <li key={i} className="text-sm" style={{ color: "var(--color-overdue)" }}>
                    {gap}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ApplicationDetailPage() {
  return (
    <Suspense fallback={<p className="px-4 text-sm text-foreground-muted">Loading...</p>}>
      <DetailContent />
    </Suspense>
  );
}
