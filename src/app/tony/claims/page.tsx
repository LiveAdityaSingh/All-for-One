"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db } from "@/lib/db";
import { useAgentName } from "@/lib/use-agent-names";
import { nanoid } from "@/lib/id";
import type { Claim } from "@/lib/types";

// The verified claims ledger (build spec §6): every skill/achievement is
// entered once and explicitly confirmed. Tony's CV suggestions may only
// ever draw from claims marked confirmed here.
export default function ClaimsPage() {
  const name = useAgentName("tony");
  const claims = useLiveQuery(() => db.claims.toArray(), []);
  const [text, setText] = useState("");

  async function addClaim(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    const claim: Claim = {
      id: nanoid(),
      text: text.trim(),
      confirmed: false,
      createdAt: new Date().toISOString(),
    };
    await db.claims.add(claim);
    setText("");
  }

  async function toggleConfirmed(claim: Claim) {
    await db.claims.put({ ...claim, confirmed: !claim.confirmed });
  }

  return (
    <div className="flex flex-col gap-4 px-4">
      <h1 className="text-lg font-semibold" style={{ color: "var(--color-tony)" }}>
        Verified claims
      </h1>
      <p className="text-sm text-foreground-muted">
        Only confirmed claims can be used in CV suggestions. Nothing here is invented for you -
        add it once, confirm it&apos;s true, and {name} can reuse it.
      </p>

      <form onSubmit={addClaim} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Led a team of 4 engineers shipping a payments API"
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
        {claims?.map((claim) => (
          <li
            key={claim.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background-elevated p-3"
          >
            <span className="text-sm">{claim.text}</span>
            <button
              onClick={() => toggleConfirmed(claim)}
              className="shrink-0 rounded-full px-3 py-1 text-xs font-medium"
              style={{
                backgroundColor: claim.confirmed ? "var(--color-tony)" : "var(--color-stale)",
                color: "var(--background)",
              }}
            >
              {claim.confirmed ? "Confirmed" : "Unconfirmed"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
