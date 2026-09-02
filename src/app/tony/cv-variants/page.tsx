"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db } from "@/lib/db";
import { nanoid } from "@/lib/id";

export default function CvVariantsPage() {
  const variants = useLiveQuery(() => db.cvVariants.toArray(), []);
  const [name, setName] = useState("");

  async function addVariant(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    await db.cvVariants.add({ id: nanoid(), name: name.trim(), createdAt: new Date().toISOString() });
    setName("");
  }

  return (
    <div className="flex flex-col gap-4 px-4">
      <h1 className="text-lg font-semibold" style={{ color: "var(--color-tony)" }}>
        CV variants
      </h1>
      <p className="text-sm text-foreground-muted">
        Track which named version of your CV (e.g. AI Engineer, Data Scientist) went to which
        application.
      </p>

      <form onSubmit={addVariant} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. ML Engineer"
          className="flex-1 rounded-lg border border-border bg-background-elevated px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-full px-4 py-2 text-sm font-medium"
          style={{ backgroundColor: "var(--color-tony)", color: "var(--background)" }}
        >
          Add
        </button>
      </form>

      <ul className="flex flex-col gap-2">
        {variants?.map((variant) => (
          <li key={variant.id} className="rounded-lg border border-border bg-background-elevated p-3 text-sm">
            {variant.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
