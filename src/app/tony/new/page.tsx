"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { db } from "@/lib/db";
import { nanoid } from "@/lib/id";

export default function NewApplicationPage() {
  const router = useRouter();
  const cvVariants = useLiveQuery(() => db.cvVariants.toArray(), []);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [cvVariantId, setCvVariantId] = useState<string>("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!company.trim() || !role.trim()) return;

    const now = new Date().toISOString();
    await db.applications.add({
      id: nanoid(),
      company: company.trim(),
      role: role.trim(),
      stage: "applied",
      lifecycleStatus: "active",
      cvVariantId: cvVariantId || null,
      appliedAt: now,
      stageEnteredAt: now,
      lastNudgedAt: null,
      nudgesIgnored: 0,
      notes: "",
    });

    router.push("/tony");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4">
      <h1 className="text-lg font-semibold" style={{ color: "var(--color-tony)" }}>
        Log an application
      </h1>

      <label className="flex flex-col gap-1 text-sm">
        Company
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="rounded-lg border border-border bg-background-elevated px-3 py-2"
          autoFocus
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Role
        <input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-lg border border-border bg-background-elevated px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        CV variant used
        <select
          value={cvVariantId}
          onChange={(e) => setCvVariantId(e.target.value)}
          className="rounded-lg border border-border bg-background-elevated px-3 py-2"
        >
          <option value="">None selected</option>
          {cvVariants?.map((variant) => (
            <option key={variant.id} value={variant.id}>
              {variant.name}
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        className="rounded-full px-4 py-2 text-sm font-medium"
        style={{ backgroundColor: "var(--color-tony)", color: "var(--background)" }}
      >
        Save
      </button>
    </form>
  );
}
