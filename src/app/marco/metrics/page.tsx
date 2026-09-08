"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ageFrom, cleanNumber, getBodyMetrics, saveBodyMetrics } from "@/lib/metrics";
import { useAgentName } from "@/lib/use-agent-names";
import { bmiFrom } from "@/lib/body-potential";
import type { BodyMetrics, Sex } from "@/lib/types";

const SEXES: { value: Sex; label: string }[] = [
  { value: "unspecified", label: "Prefer not to say" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
];

// The saved record arrives asynchronously, so the form is mounted only
// once it has - seeding state from props rather than syncing it in an
// effect, which would otherwise overwrite whatever was being typed.
export default function MetricsPage() {
  const stored = useLiveQuery(() => getBodyMetrics(), []);
  if (stored === undefined) {
    return <p className="px-4 text-sm text-foreground-muted">Loading...</p>;
  }
  return <MetricsForm initial={stored} />;
}

function MetricsForm({ initial }: { initial: BodyMetrics | undefined }) {
  const router = useRouter();
  const name = useAgentName("marco");

  const [height, setHeight] = useState(initial?.heightCm ? String(initial.heightCm) : "");
  const [weight, setWeight] = useState(initial?.weightKg ? String(initial.weightKg) : "");
  const [birthYear, setBirthYear] = useState(
    initial?.birthYear ? String(initial.birthYear) : "",
  );
  const [sex, setSex] = useState<Sex>(initial?.sex ?? "unspecified");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();

    const heightCm = height.trim() ? cleanNumber(height, 50, 250) : null;
    const weightKg = weight.trim() ? cleanNumber(weight, 20, 400) : null;
    const year = birthYear.trim() ? cleanNumber(birthYear, 1900, new Date().getFullYear()) : null;

    if (height.trim() && heightCm === null) return setError("Height should be in cm, between 50 and 250.");
    if (weight.trim() && weightKg === null) return setError("Weight should be in kg, between 20 and 400.");
    if (birthYear.trim() && year === null) return setError("Birth year looks wrong.");

    setError(null);
    await saveBodyMetrics({ heightCm, weightKg, birthYear: year, sex });
    setSaved(true);
    setTimeout(() => router.push("/marco"), 700);
  }

  const previewBmi = bmiFrom({
    id: "me",
    heightCm: cleanNumber(height, 50, 250),
    weightKg: cleanNumber(weight, 20, 400),
    birthYear: null,
    sex,
    updatedAt: "",
  });
  const age = ageFrom(cleanNumber(birthYear, 1900, new Date().getFullYear()));

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-4 px-4">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: "var(--color-marco)" }}>
          Your measurements
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          {name} uses these to turn what you log into something comparable. Everything
          here stays on this device, and every field is optional &mdash; leave one blank
          and the parts that need it are simply left out.
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Height
        <div className="flex items-center gap-2">
          <input
            inputMode="decimal"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            placeholder="180"
            className="flex-1 rounded-lg border border-border bg-background-elevated px-3 py-2"
          />
          <span className="text-xs text-foreground-muted">cm</span>
        </div>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Weight
        <div className="flex items-center gap-2">
          <input
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="75"
            className="flex-1 rounded-lg border border-border bg-background-elevated px-3 py-2"
          />
          <span className="text-xs text-foreground-muted">kg</span>
        </div>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Year of birth
        <input
          inputMode="numeric"
          value={birthYear}
          onChange={(e) => setBirthYear(e.target.value)}
          placeholder="1996"
          className="rounded-lg border border-border bg-background-elevated px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Sex
        <select
          value={sex}
          onChange={(e) => setSex(e.target.value as Sex)}
          className="rounded-lg border border-border bg-background-elevated px-3 py-2"
        >
          {SEXES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <span className="text-xs text-foreground-muted">
          Only used where the arithmetic actually differs.
        </span>
      </label>

      {(previewBmi || age) && (
        <div className="lip rounded-xl border border-border bg-background-elevated p-3 text-sm">
          {previewBmi && (
            <p>
              BMI <span style={{ color: "var(--color-marco)" }}>{previewBmi}</span>
            </p>
          )}
          {age && <p className="text-xs text-foreground-muted">Age {age}</p>}
        </div>
      )}

      {error && <p className="text-sm" style={{ color: "var(--color-overdue)" }}>{error}</p>}

      <button
        type="submit"
        className="rounded-full px-4 py-2 text-sm font-medium"
        style={{ backgroundColor: "var(--color-marco)", color: "var(--background)" }}
      >
        {saved ? "Saved" : "Save"}
      </button>
    </form>
  );
}
