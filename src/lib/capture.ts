// Turns a parsed utterance into stored data. Everything here writes to
// the local database only - capture must survive being offline on the
// tube or in a dead zone (build spec §12).
import { db } from "./db";
import { softDelete } from "./backup";
import type { SyncedTable } from "./db";
import { formatMoney } from "./locale";
import { nanoid } from "./id";
import { categoryFor, classifyUtterance, describeIntent, type CaptureIntent } from "./intent";
import { addTransaction, deleteTransaction } from "./money";
import { addTask } from "./tasks";
import { revertBalance, updateBalance, type BalanceChange } from "./finance";
import { answerQuestion, type Answer } from "./cross-agent";
import { escalate } from "./intent/escalate";
import type { AgentId } from "./types";
import { getAgentNameOverrides, getAgentNames, nameClash } from "./agent-names";
import { useAgentNamesStore } from "@/store/agent-names-store";
import { CURRENCY_NAMES, getCurrency, type CurrencyCode } from "./locale";

// Everything needed to put the database back exactly as it was. Voice
// mis-hears, and without this the only way to fix a wrong capture is to
// navigate to the agent and hunt for it - which is how a month of testing
// accumulates junk nobody wants to clean up.
export type UndoStep =
  | { kind: "delete"; table: SyncedTable; id: string }
  | { kind: "deleteTransaction"; id: string }
  | { kind: "revertBalance"; change: BalanceChange }
  // `previous` is the override that was in place, not the name that was
  // showing: null restores the shipped default rather than pinning it.
  | { kind: "renameAgent"; id: AgentId; previous: string | null };

export async function undoCapture(steps: UndoStep[]): Promise<void> {
  // Reverse order, so a capture that wrote several rows unwinds the way it
  // was written.
  for (const step of [...steps].reverse()) {
    if (step.kind === "delete") await softDelete(step.table, step.id);
    else if (step.kind === "deleteTransaction") await deleteTransaction(step.id);
    else if (step.kind === "renameAgent")
      useAgentNamesStore.getState().rename(step.id, step.previous);
    else await revertBalance(step.change);
  }
}

export interface CaptureOutcome {
  ok: boolean;
  agent: AgentId | null;
  message: string;
  // Present only for questions: the answer plus the agents it drew on, so
  // every cross-agent query can show its reason (build spec §10).
  answer?: Answer;
  // How to reverse what this capture wrote, when it wrote anything.
  undo?: UndoStep[];
}

// A spoken bank name ("Monzo") is matched against the accounts the user
// actually added, so a transaction can be attributed rather than floating.
async function resolveAccountId(name: string | null): Promise<string | null> {
  if (!name) return null;
  const needle = name.toLowerCase().trim();
  const accounts = await db.accounts.toArray();
  const match =
    accounts.find((a) => a.name.toLowerCase() === needle) ??
    accounts.find((a) => a.name.toLowerCase().includes(needle));
  return match?.id ?? null;
}

async function persist(intent: CaptureIntent, raw: string): Promise<UndoStep[]> {
  const now = new Date().toISOString();

  if (intent.type === "log_application") {
    const id = nanoid();
    await db.applications.add({
      id,
      company: intent.company,
      role: intent.role,
      stage: "applied",
      lifecycleStatus: "active",
      cvVariantId: null,
      appliedAt: now,
      stageEnteredAt: now,
      lastNudgedAt: null,
      nudgesIgnored: 0,
      notes: "",
    });
    return [{ kind: "delete", table: "applications", id }];
  }

  // The user's own words are kept alongside the parse, so a mis-reading
  // is always recoverable from the original.
  const base = { id: nanoid(), raw, capturedAt: now };

  // Money is a real transaction now, not a loose capture: the finance
  // screen rolls income and spending up per period and by category.
  if (intent.type === "log_expense") {
    const id = await addTransaction(
      "expense",
      intent.amount,
      categoryFor(intent.merchant),
      raw,
      await resolveAccountId(intent.account),
    );
    return [{ kind: "deleteTransaction", id }];
  }

  if (intent.type === "log_income") {
    const id = await addTransaction(
      "income",
      intent.amount,
      "Income",
      raw,
      await resolveAccountId(intent.account),
    );
    return [{ kind: "deleteTransaction", id }];
  }

  if (intent.type === "log_workout") {
    await db.captures.add({
      ...base,
      kind: "workout",
      agent: "marco",
      label: intent.activity,
      durationMinutes: intent.durationMinutes,
    });
    return [{ kind: "delete", table: "captures", id: base.id }];
  }

  if (intent.type === "log_sleep") {
    await db.captures.add({
      ...base,
      kind: "sleep",
      agent: "marco",
      label: "Sleep",
      durationMinutes: intent.durationMinutes,
    });
    return [{ kind: "delete", table: "captures", id: base.id }];
  }

  if (intent.type === "log_meal") {
    await db.captures.add({
      ...base,
      kind: "meal",
      agent: "marco",
      label: intent.description,
    });
    return [{ kind: "delete", table: "captures", id: base.id }];
  }

  if (intent.type === "set_balance") {
    // Handled before this point; the account has to be resolved against
    // what the user actually has, which persist() has no view of.
    return [];
  }

  // Lisa's surface exists now, so a spoken reminder becomes a real task
  // rather than a loose capture waiting for a home.
  const taskId = await addTask(intent.title, "one_off", intent.when);
  return [{ kind: "delete", table: "tasks", id: taskId }];
}

// Spoken balance updates name an account the way the user thinks of it
// ("monzo"), which has to be matched against what they actually added.
async function applyBalance(
  accountName: string,
  amount: number,
): Promise<CaptureOutcome> {
  const accounts = await db.accounts.toArray();
  const needle = accountName.toLowerCase().trim();

  const match =
    accounts.find((a) => a.name.toLowerCase() === needle) ??
    accounts.find((a) => a.name.toLowerCase().includes(needle)) ??
    accounts.find((a) => needle.includes(a.name.toLowerCase()));

  if (!match) {
    return {
      ok: false,
      agent: null,
      message: accounts.length
        ? `No account called "${accountName}". You have: ${accounts.map((a) => a.name).join(", ")}.`
        : `No accounts yet - add one on the ${getAgentNames().vanessa} screen first.`,
    };
  }

  const change = await updateBalance(match.id, amount);
  return {
    ok: true,
    agent: "vanessa",
    message: `${match.name} updated to ${formatMoney(amount)}`,
    undo: change ? [{ kind: "revertBalance", change }] : [],
  };
}

// The app stores bare numbers so totals can be summed, which means a
// currency word the user said out loud has no effect on what is shown.
// Dropping it silently would let the app disagree with them by roughly a
// hundredfold, so the capture still happens and the mismatch is stated.
function currencyNote(spoken: CurrencyCode | null | undefined): string {
  if (!spoken) return "";
  const setting = getCurrency();
  if (spoken === setting) return "";
  return ` — you said ${CURRENCY_NAMES[spoken]}, but currency is set to ${CURRENCY_NAMES[setting]}`;
}

const UNPARSED_HINT =
  "I didn't catch that. Try \"applied to Acme for Data Scientist\", " +
  "\"spent 12 quid on lunch\", \"did 45 minutes legs\", " +
  "\"remind me to call the plumber at 5pm\", or ask \"what's my runway?\".";

function applyRename(target: AgentId, name: string): CaptureOutcome {
  const names = getAgentNames();
  const before = names[target];

  if (before === name) {
    return { ok: true, agent: null, message: `Already called "${name}".` };
  }

  // Two agents answering to one word would make every later spoken rename
  // ambiguous, so this is refused rather than quietly allowed.
  const clash = nameClash(names, target, name);
  if (clash) {
    return {
      ok: false,
      agent: null,
      message: `"${names[clash]}" is already taken. Pick a different name.`,
    };
  }

  const previous = getAgentNameOverrides()[target] ?? null;
  useAgentNamesStore.getState().rename(target, name);

  return {
    ok: true,
    agent: null,
    message: `Renamed ${before} to ${name}.`,
    undo: [{ kind: "renameAgent", id: target, previous }],
  };
}

export async function captureUtterance(text: string): Promise<CaptureOutcome> {
  let intent = classifyUtterance(text);

  // Only what the dictionary could not read reaches a model (build spec §3).
  // Escalation returns null on any failure, so this is never worse than the
  // on-device result - it can only add captures that would have been lost.
  if (intent.type === "unhandled") {
    const escalated = await escalate(text);
    if (escalated) intent = escalated;
  }

  if (intent.type === "unhandled") {
    return { ok: false, agent: null, message: UNPARSED_HINT };
  }

  // Questions are answered from data already on the device, and never
  // routed to an agent screen - the answer comes back inline.
  if (intent.type === "question") {
    const answer = await answerQuestion(intent.topic);
    return { ok: true, agent: null, message: answer.text, answer };
  }

  // Renaming changes what the app calls things, never any stored record,
  // so it is applied inline and never routes to an agent screen.
  if (intent.type === "rename_agent") {
    return applyRename(intent.target, intent.name);
  }

  if (intent.type === "set_balance") {
    const outcome = await applyBalance(intent.accountName, intent.amount);
    return { ...outcome, message: outcome.message + currencyNote(intent.spokenCurrency) };
  }

  const undo = await persist(intent, text.trim());

  const spoken =
    intent.type === "log_expense" || intent.type === "log_income"
      ? intent.spokenCurrency
      : null;

  return {
    ok: true,
    agent: intent.agent,
    message: describeIntent(intent) + currencyNote(spoken),
    undo,
  };
}
