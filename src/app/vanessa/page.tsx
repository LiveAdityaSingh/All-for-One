"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useMoney } from "@/lib/use-money";
import { useState } from "react";
import { ChatInputBar } from "@/components/chat-input-bar";
import { CategoryChart } from "@/components/finance/category-chart";
import { PulseCard } from "@/components/finance/pulse-card";
import { db } from "@/lib/db";
import { addAccount, computeRunway, daysSince, isStale, updateBalance } from "@/lib/finance";
import {
  deleteTransaction,
  getMonthlyLimit,
  PERIOD_LABELS,
  resolvePeriod,
  setMonthlyLimit,
  spendByCategory,
  totalsFor,
  transactionsToCsv,
  type PeriodKey,
} from "@/lib/money";
import type { Account, Transaction } from "@/lib/types";

const PERIODS: PeriodKey[] = ["today", "week", "month", "custom"];



function AccountCard({ account }: { account: Account }) {
  const { formatMoney: money } = useMoney();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const stale = isStale(account);
  const days = Math.floor(daysSince(account.updatedAt));

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const parsed = Number(value);
    if (Number.isFinite(parsed)) await updateBalance(account.id, parsed);
    setValue("");
    setEditing(false);
  }

  return (
    <div className="w-44 shrink-0 rounded-2xl border border-border bg-background-elevated p-3">
      <span
        className="mb-3 block h-1 w-16 rounded-full"
        style={{ backgroundColor: stale ? "var(--color-stale)" : "var(--color-vanessa)" }}
      />
      <p className="truncate text-sm font-medium">{account.name}</p>

      {editing ? (
        <form onSubmit={save} className="mt-1 flex gap-1">
          <input
            autoFocus
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => setEditing(false)}
            placeholder="New balance"
            className="w-full rounded-lg border border-border bg-background px-2 py-1 text-sm"
          />
        </form>
      ) : (
        <p
          className="text-xl font-semibold"
          style={{ color: stale ? "var(--color-stale)" : "var(--foreground)" }}
        >
          {money(account.balance)}
        </p>
      )}

      <p className="text-[11px] text-foreground-muted">
        {account.goal || "Current Balance"}
      </p>
      <button
        onClick={() => setEditing(true)}
        className="mt-1 text-[11px] underline"
        style={{ color: stale ? "var(--color-overdue)" : "var(--foreground-muted)" }}
      >
        {stale ? `Stale · ${days}d — update` : "Tap to edit"}
      </button>
    </div>
  );
}

export default function VanessaPage() {
  const { formatMoney: money } = useMoney();
  const accounts = useLiveQuery(() => db.accounts.toArray(), []);
  const snapshots = useLiveQuery(() => db.balanceSnapshots.toArray(), []);
  const transactions = useLiveQuery(
    () => db.transactions.orderBy("occurredAt").reverse().toArray(),
    [],
  );
  const limit = useLiveQuery(() => getMonthlyLimit(), []) ?? 0;

  const [periodKey, setPeriodKey] = useState<PeriodKey>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [balance, setBalance] = useState("");

  const custom =
    customFrom && customTo
      ? { from: new Date(customFrom), to: new Date(customTo) }
      : undefined;
  const period = resolvePeriod(periodKey, new Date(), custom);

  const rows = transactions ?? [];
  const totals = totalsFor(rows, period);
  const slices = spendByCategory(rows, period);
  const visible = rows.filter(
    (t) =>
      new Date(t.occurredAt) >= period.from && new Date(t.occurredAt) <= period.to,
  );

  const runway = computeRunway(accounts ?? [], snapshots ?? []);
  const accountTotal = (accounts ?? []).reduce((sum, a) => sum + a.balance, 0);
  const anyStale = (accounts ?? []).some((a) => isStale(a));

  async function handleAddAccount(event: React.FormEvent) {
    event.preventDefault();
    const parsed = Number(balance);
    if (!name.trim() || !Number.isFinite(parsed)) return;
    await addAccount(name, goal, parsed);
    setName("");
    setGoal("");
    setBalance("");
    setShowAdd(false);
  }

  function handleExport() {
    const blob = new Blob([transactionsToCsv(visible)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "transactions.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-2 px-4">
        <div>
          <h1 className="agent-text-glow text-2xl font-semibold"
            style={{ color: "var(--color-vanessa)", ["--glow" as string]: "var(--color-vanessa)" }}>
            Vanessa
          </h1>
          <p className="text-xs text-foreground-muted">Money manager</p>
        </div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm"
          style={{ borderColor: "var(--color-vanessa-muted)", color: "var(--color-vanessa)" }}
        >
          <span aria-hidden>⊕</span> Account
        </button>
      </header>

      {/* Income / Expenses / Net for the selected period. Red and green do
          numeric work here; Vanessa's identity hue stays violet, which is
          exactly why those two are free to mean loss and gain (spec §4). */}
      <div className="mx-4 grid grid-cols-3 divide-x divide-border rounded-2xl border border-border bg-background-elevated py-3">
        {[
          { label: "INCOME", value: money(totals.income), color: "oklch(0.72 0.16 155)" },
          { label: "EXPENSES", value: money(totals.expenses), color: "var(--color-overdue)" },
          {
            label: "NET",
            value: `${totals.net >= 0 ? "+" : "−"}${money(Math.abs(totals.net))}`,
            color: totals.net >= 0 ? "oklch(0.72 0.16 155)" : "var(--color-overdue)",
          },
        ].map((cell) => (
          <div key={cell.label} className="flex flex-col items-center gap-0.5 px-2">
            <span className="text-[10px] tracking-wider text-foreground-muted">{cell.label}</span>
            <span className="text-lg font-semibold" style={{ color: cell.color }}>
              {cell.value}
            </span>
          </div>
        ))}
      </div>

      <PulseCard runway={runway} />

      <label className="mx-4 flex items-center justify-between rounded-xl border border-border bg-background-elevated px-3 py-2.5">
        <span className="text-sm">
          Monthly Limit
          <span className="ml-1 text-xs text-foreground-muted">
            {limit > 0 && totals.expenses > limit ? "· over" : "· this month"}
          </span>
        </span>
        <input
          inputMode="decimal"
          value={limit || ""}
          placeholder={money(0)}
          onChange={(e) => setMonthlyLimit(Number(e.target.value) || 0)}
          className="w-24 bg-transparent text-right text-sm font-semibold outline-none"
          style={{
            color: limit > 0 && totals.expenses > limit
              ? "var(--color-overdue)"
              : "var(--foreground)",
          }}
        />
      </label>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Accounts</h2>
            <span
              className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: "color-mix(in oklch, var(--color-vanessa) 18%, transparent)",
                color: "var(--color-vanessa)",
              }}
            >
              {money(accountTotal)}
            </span>
          </div>
          {/* Freshness, not a confidence badge: the template's "SAFE" chip
              would assert certainty over balances that may be weeks old. */}
          <span
            className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
            style={{ borderColor: "var(--border)" }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: anyStale ? "var(--color-overdue)" : "oklch(0.72 0.16 155)" }}
            />
            {anyStale ? "Needs update" : "Up to date"}
          </span>
        </div>

        {showAdd && (
          <form onSubmit={handleAddAccount} className="mx-4 flex flex-col gap-2 rounded-xl border border-border bg-background-elevated p-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Account name (e.g. Monzo)"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="What it's for"
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <input
                inputMode="decimal"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                placeholder="Balance"
                className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              className="rounded-full px-4 py-2 text-sm font-medium"
              style={{ backgroundColor: "var(--color-vanessa)", color: "var(--background)" }}
            >
              Add account
            </button>
          </form>
        )}

        {accounts && accounts.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto px-4 pb-1">
            {accounts.map((account) => <AccountCard key={account.id} account={account} />)}
          </div>
        ) : (
          !showAdd && (
            <p className="px-4 text-sm text-foreground-muted">
              No accounts yet. Add the ones you actually use and say what each is for.
            </p>
          )
        )}
      </section>

      <div className="flex gap-2 overflow-x-auto px-4">
        {PERIODS.map((key) => (
          <button
            key={key}
            onClick={() => setPeriodKey(key)}
            className="shrink-0 rounded-full border px-4 py-1.5 text-sm"
            style={{
              borderColor: periodKey === key ? "var(--color-vanessa)" : "var(--border)",
              color: periodKey === key ? "var(--color-vanessa)" : "var(--foreground-muted)",
            }}
          >
            {PERIOD_LABELS[key]}
          </button>
        ))}
      </div>

      {periodKey === "custom" && (
        <div className="flex gap-2 px-4">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-background-elevated px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-background-elevated px-3 py-2 text-sm"
          />
        </div>
      )}

      <section className="mx-4 rounded-2xl border border-border bg-background-elevated p-4">
        <h2 className="mb-3 text-base font-semibold">Spending by Category</h2>
        <CategoryChart slices={slices} />
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-4">
          <h2 className="text-base font-semibold">Transactions</h2>
          <button
            onClick={handleExport}
            disabled={visible.length === 0}
            aria-label="Export transactions as CSV"
            className="text-xs text-foreground-muted underline disabled:opacity-40"
          >
            Export CSV
          </button>
        </div>

        {visible.length === 0 ? (
          <p className="mx-4 rounded-xl border border-border bg-background-elevated px-3 py-8 text-center text-sm text-foreground-muted">
            No transactions in this period
          </p>
        ) : (
          <ul className="flex flex-col gap-2 px-4">
            {visible.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                accountName={
                  accounts?.find((a) => a.id === transaction.accountId)?.name ?? null
                }
              />
            ))}
          </ul>
        )}
      </section>

      <ChatInputBar
        variant="agent"
        placeholder={`e.g. ${money(12)} on lunch`}
      />
    </div>
  );
}

function TransactionRow({
  transaction,
  accountName,
}: {
  transaction: Transaction;
  accountName: string | null;
}) {
  const { formatMoney: money } = useMoney();
  const income = transaction.type === "income";
  return (
    <li className="lip flex items-center gap-3 rounded-xl border border-border bg-background-elevated p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{transaction.category}</p>
        <p className="truncate text-xs text-foreground-muted">
          {new Date(transaction.occurredAt).toLocaleDateString()}
          {transaction.note && ` · ${transaction.note}`}
        </p>
        {/* Which account this moved. Without it the balance change looks
            like it came from nowhere and can't be checked. */}
        <p className="truncate text-[11px]">
          {accountName ? (
            <span style={{ color: "var(--color-vanessa)" }}>{accountName}</span>
          ) : (
            <span className="text-foreground-muted">No account · balance unchanged</span>
          )}
        </p>
      </div>
      <span
        className="shrink-0 text-sm font-semibold"
        style={{ color: income ? "oklch(0.72 0.16 155)" : "var(--foreground)" }}
      >
        {income ? "+" : "−"}
        {money(transaction.amount)}
      </span>
      <button
        onClick={() => deleteTransaction(transaction.id)}
        className="shrink-0 text-xs text-foreground-muted underline"
      >
        Delete
      </button>
    </li>
  );
}
