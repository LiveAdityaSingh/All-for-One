"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { deleteTransaction } from "@/lib/money";
import { useMoney } from "@/lib/use-money";
import { useAgentName } from "@/lib/use-agent-names";

// The main screen is scoped to a period, which is right for judging a
// month but wrong for finding one transaction from March. This is every
// transaction, ever.
export default function TransactionRecordsPage() {
  const name = useAgentName("vanessa");
  const { formatMoney: money } = useMoney();
  const transactions = useLiveQuery(
    () => db.transactions.orderBy("occurredAt").reverse().toArray(),
    [],
  );

  const rows = transactions ?? [];
  const income = rows.filter((t) => t.type === "income").length;

  return (
    <div className="flex flex-col gap-4 px-4">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: "var(--color-vanessa)" }}>
          All transactions
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Everything {name} holds, newest first — {rows.length} in total
          {income > 0 ? `, ${income} of them income` : ""}.
        </p>
      </div>

      {rows.length === 0 && <p className="text-sm text-foreground-muted">Nothing logged yet.</p>}

      <ul className="flex flex-col gap-2">
        {rows.map((t) => (
          <li
            key={t.id}
            className="lip flex items-center gap-3 rounded-xl border border-border bg-background-elevated p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{t.category}</p>
              <p className="truncate text-xs text-foreground-muted">
                {new Date(t.occurredAt).toLocaleDateString()}
                {t.note ? ` · ${t.note}` : ""}
              </p>
            </div>
            <span
              className="shrink-0 text-sm font-semibold tabular-nums"
              style={{
                color: t.type === "income" ? "oklch(0.72 0.16 155)" : "var(--color-overdue)",
              }}
            >
              {t.type === "income" ? "+" : "−"}
              {money(t.amount)}
            </span>
            <button
              onClick={() => deleteTransaction(t.id)}
              className="shrink-0 text-xs text-foreground-muted underline"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
