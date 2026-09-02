// The second half of the architecture in build spec §3: cheap dictionary
// matching handles the ~80% of utterances that are simple capture, and only
// what it cannot read escalates to a model. Escalation therefore runs on a
// miss, never on the happy path, which is what keeps a free tier viable.
//
// Everything here degrades to null. A miss, a timeout, a retired model, no
// key, no signal - all produce the same result as today: the on-device hint.
// The app must never be worse for having tried.
import {
  chatCompletion,
  isOnline,
  MissingKeyError,
  MODEL_CHAIN,
  RateLimitedError,
} from "@/lib/llm";
import type { ParsedIntent } from "./index";

// Escalation only runs on a miss - the path where the user would otherwise
// get nothing - so it can afford a little longer than the happy path. But a
// slow primary must not eat the whole budget and starve the fallback, so
// each attempt is capped as well as the total.
// Measured against the live free tier: the primary succeeds about half the
// time and, importantly, FAILS FAST (~500ms, "provider overloaded"), so the
// fallback usually still lands well inside the budget. The per-attempt cap
// is set above the fallback's observed worst case (~1.8s) so a slow-but-
// working answer is not thrown away.
const TOTAL_BUDGET_MS = 6000;
const PER_ATTEMPT_MS = 3000;

const SCHEMA = {
  name: "captured_intent",
  schema: {
    type: "object",
    additionalProperties: false,
    // Strict mode requires every property to be listed as required, so
    // unused fields are explicitly nulled rather than omitted.
    required: [
      "kind", "company", "role", "amount", "merchant", "account",
      "activity", "durationMinutes", "title", "accountName",
    ],
    properties: {
      kind: {
        type: "string",
        enum: ["application", "expense", "workout", "event", "balance", "none"],
        description: "none when the text is not one of these five captures",
      },
      company: { type: ["string", "null"] },
      role: { type: ["string", "null"] },
      amount: { type: ["number", "null"], description: "in pounds" },
      merchant: { type: ["string", "null"] },
      account: { type: ["string", "null"] },
      activity: { type: ["string", "null"] },
      durationMinutes: { type: ["number", "null"] },
      title: { type: ["string", "null"] },
      accountName: { type: ["string", "null"] },
    },
  },
} as const;

const SYSTEM = [
  "You convert one short spoken sentence into a single structured capture",
  "for a personal life-management app. The five kinds are:",
  "application (a job application), expense (money spent), workout",
  "(exercise done), event (something to be reminded of), balance (setting",
  "an account's current balance).",
  "",
  "Return kind \"none\" if the sentence is not clearly one of those five.",
  "",
  // Without this the model reads "heard back from Globex, they want a
  // second interview" as a NEW application and silently creates a
  // duplicate. News about a thing that already exists is not a capture.
  "Only capture an action the speaker is RECORDING as done or planned by",
  "them. News, status updates and reactions about something that already",
  "exists are NOT captures - \"heard back from X\", \"they want a second",
  "interview\", \"still waiting on Y\" are all kind \"none\".",
  "When in doubt, return none. A wrong capture writes bad data the user",
  "must find and delete; a missed one only asks them to rephrase.",
  "",
  "Never invent a value that was not said: leave a field null instead.",
  "Amounts are in pounds. Durations are in whole minutes.",
].join("\n");

interface ModelIntent {
  kind: "application" | "expense" | "workout" | "event" | "balance" | "none";
  company: string | null;
  role: string | null;
  amount: number | null;
  merchant: string | null;
  account: string | null;
  activity: string | null;
  durationMinutes: number | null;
  title: string | null;
  accountName: string | null;
}

// The model sometimes returns "" rather than null for a field it has no
// value for, which would otherwise be stored as a blank label.
function str(value: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function num(value: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// Kept separate from the network call so the mapping is testable on its own.
export function intentFromModelOutput(
  input: ModelIntent | null,
): ParsedIntent | null {
  if (!input || input.kind === "none") return null;

  // Normalise before reading: every field is either a real value or null.
  const raw = {
    kind: input.kind,
    company: str(input.company),
    role: str(input.role),
    amount: num(input.amount),
    merchant: str(input.merchant),
    account: str(input.account),
    activity: str(input.activity),
    durationMinutes: num(input.durationMinutes),
    title: str(input.title),
    accountName: str(input.accountName),
  };

  switch (raw.kind) {
    case "application":
      if (!raw.company || !raw.role) return null;
      return {
        type: "log_application",
        agent: "tony",
        company: raw.company,
        role: raw.role,
      };

    case "expense":
      // An expense with no amount is not a capture, it is a guess.
      if (raw.amount === null) return null;
      return {
        type: "log_expense",
        agent: "vanessa",
        amount: raw.amount,
        merchant: raw.merchant ?? "Unspecified",
        account: raw.account,
      };

    case "workout":
      if (!raw.activity && raw.durationMinutes === null) return null;
      return {
        type: "log_workout",
        agent: "marco",
        activity: raw.activity ?? "Workout",
        durationMinutes: raw.durationMinutes,
      };

    case "event":
      if (!raw.title) return null;
      return { type: "schedule_event", agent: "lisa", title: raw.title, when: null };

    case "balance":
      if (!raw.accountName || raw.amount === null) return null;
      return {
        type: "set_balance",
        agent: "vanessa",
        accountName: raw.accountName,
        amount: raw.amount,
      };
  }
}

async function attempt(
  text: string,
  choice: { provider: "groq" | "openrouter"; model: string },
  timeoutMs: number,
): Promise<ParsedIntent | null> {
  const reply = await chatCompletion(
    [
      { role: "system", content: SYSTEM },
      { role: "user", content: text },
    ],
    { provider: choice.provider, model: choice.model, schema: SCHEMA, timeoutMs },
  );
  return intentFromModelOutput(JSON.parse(reply) as ModelIntent);
}

export async function escalate(text: string): Promise<ParsedIntent | null> {
  // Offline is the normal case for this app, not an error - do not even try.
  if (!isOnline()) return null;

  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const exhausted = new Set<string>();

  // Free tiers fail often enough - overloaded upstreams, daily quotas -
  // that one attempt drops captures the user actually made. The chain
  // spans two providers, but they all share one budget so a bad day can
  // never hang the voice loop.
  for (const choice of MODEL_CHAIN.intent) {
    if (exhausted.has(choice.provider)) continue;

    const remaining = deadline - Date.now();
    if (remaining < 600) break;

    try {
      return await attempt(text, choice, Math.min(remaining, PER_ATTEMPT_MS));
    } catch (error) {
      // No key for this provider, or its quota is spent: skip its other
      // models rather than spending the user's time failing identically.
      if (error instanceof MissingKeyError || error instanceof RateLimitedError) {
        exhausted.add(choice.provider);
        continue;
      }
      // Overloaded, retired, timed out, unparseable: try the next model if
      // there is budget, otherwise fall through to the on-device hint.
    }
  }

  return null;
}
