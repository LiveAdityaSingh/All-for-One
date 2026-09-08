// On-device intent classification (build spec §3): the simple-capture
// utterances that make up most of the traffic are matched against plain
// dictionaries and regexes here, with no model call and no network. Only
// genuine reasoning escalates to a frontier model, which is what keeps
// the unit economics viable at a subscription price.
import type { AgentId } from "@/lib/types";
import { getAgentNames, normaliseAgentName, resolveAgent } from "@/lib/agent-names";
import { formatMoney, type CurrencyCode } from "@/lib/locale";
import { extractDurationMinutes, extractMoney, extractWhen } from "./extract";
import {
  APPLICATION_VERBS,
  EXPENSE_CATEGORIES,
  EXPENSE_VERBS,
  CATEGORY_MAP,
  INCOME_VERBS,
  KNOWN_ACCOUNTS,
  SCHEDULE_VERBS,
  VERB_ACTIVITIES,
  WORKOUT_ACTIVITIES,
  WORKOUT_VERBS,
} from "./lexicon";

export interface ApplicationIntent {
  type: "log_application";
  agent: "tony";
  company: string;
  role: string;
}

export interface ExpenseIntent {
  type: "log_expense";
  agent: "vanessa";
  amount: number;
  merchant: string;
  account: string | null;
  // Set when the user named a currency out loud, so a contradiction with
  // their setting can be shown rather than silently ignored.
  spokenCurrency?: CurrencyCode | null;
}

export interface IncomeIntent {
  type: "log_income";
  agent: "vanessa";
  amount: number;
  source: string;
  account: string | null;
  spokenCurrency?: CurrencyCode | null;
}

export interface WorkoutIntent {
  type: "log_workout";
  agent: "marco";
  activity: string;
  durationMinutes: number | null;
}

// Sleep is one number a night and the strongest single signal Marco has,
// so it gets its own intent rather than being filed as a workout.
export interface SleepIntent {
  type: "log_sleep";
  agent: "marco";
  durationMinutes: number;
}

// Meals are recorded as what you said you ate, not parsed into nutrients:
// the app has no food database, and inventing calorie numbers would be
// worse than honestly recording "chicken and rice".
export interface MealIntent {
  type: "log_meal";
  agent: "marco";
  description: string;
}

export interface ScheduleIntent {
  type: "schedule_event";
  agent: "lisa";
  title: string;
  when: Date | null;
}

// The balance loop is Vanessa's primary mechanic, so it has to be
// sayable: "Monzo is 1200" has to work as well as opening her screen.
export interface SetBalanceIntent {
  type: "set_balance";
  agent: "vanessa";
  accountName: string;
  amount: number;
  spokenCurrency?: CurrencyCode | null;
}

// Questions are not captures - Jarvis answers them from data already on
// the device (build spec §10), which is why they never reach a model.
export type QuestionTopic = "runway" | "pipeline" | "open_loops" | "health";

export interface QuestionIntent {
  type: "question";
  agent: "jarvis";
  topic: QuestionTopic;
}

// Renaming an agent is said to the home chat rather than only being
// buried in Settings, because the whole product assumes you can just talk
// to it. It resolves an agent by whatever you call it now, by the shipped
// default, or by its original character name.
export interface RenameIntent {
  type: "rename_agent";
  agent: "jarvis";
  target: AgentId;
  name: string;
}

export interface UnhandledIntent {
  type: "unhandled";
  agent: null;
  raw: string;
}

export type ParsedIntent =
  | ApplicationIntent
  | ExpenseIntent
  | IncomeIntent
  | WorkoutIntent
  | SleepIntent
  | MealIntent
  | ScheduleIntent
  | SetBalanceIntent
  | QuestionIntent
  | RenameIntent
  | UnhandledIntent;

export type CaptureIntent = Exclude<
  ParsedIntent,
  UnhandledIntent | QuestionIntent | RenameIntent
>;

function containsAny(text: string, words: string[]): boolean {
  return words.some((word) => new RegExp(`\\b${word}\\b`, "i").test(text));
}

function findFirst(text: string, words: string[]): string | null {
  for (const word of words) {
    if (new RegExp(`\\b${word}\\b`, "i").test(text)) return word;
  }
  return null;
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

// --- Tony -----------------------------------------------------------------

function parseApplication(text: string): ApplicationIntent | null {
  if (!containsAny(text, APPLICATION_VERBS)) return null;

  const match = text.match(
    /appl(?:ied|y|ying)\s+(?:to|at|for)\s+(.+?)\s+(?:for|as)\s+(?:an?\s+)?(.+)/i,
  );
  if (!match) return null;

  return {
    type: "log_application",
    agent: "tony",
    company: titleCase(match[1].trim()),
    role: match[2].trim(),
  };
}

// --- Vanessa --------------------------------------------------------------

function parseExpense(text: string): ExpenseIntent | null {
  if (!containsAny(text, EXPENSE_VERBS)) return null;

  const money = extractMoney(text);
  if (!money) return null;

  // "spent 40 on groceries, Monzo" - the account is whatever known bank
  // name appears, anywhere in the utterance.
  const account = findFirst(text, KNOWN_ACCOUNTS);

  let merchant = findFirst(text, EXPENSE_CATEGORIES);
  if (!merchant) {
    const onPhrase = text.match(/\b(?:on|at|for)\s+([a-z0-9'&\s-]+)/i);
    if (onPhrase) {
      merchant = onPhrase[1]
        .replace(new RegExp(`\\b(?:${KNOWN_ACCOUNTS.join("|")})\\b`, "gi"), "")
        .replace(/[,.]/g, " ")
        .trim();
    }
  }

  return {
    type: "log_expense",
    agent: "vanessa",
    amount: money.amount,
    spokenCurrency: money.spoken,
    merchant: merchant ? titleCase(merchant) : "Unspecified",
    account: account ? titleCase(account) : null,
  };
}

function parseIncome(text: string): IncomeIntent | null {
  if (!containsAny(text, INCOME_VERBS)) return null;

  const money = extractMoney(text);
  if (!money) return null;

  const account = findFirst(text, KNOWN_ACCOUNTS);
  const source = findFirst(text, INCOME_VERBS) ?? "Income";

  return {
    type: "log_income",
    agent: "vanessa",
    amount: money.amount,
    spokenCurrency: money.spoken,
    source: titleCase(source),
    account: account ? titleCase(account) : null,
  };
}

// Groups a free-text merchant into the fixed category set.
export function categoryFor(merchant: string): string {
  const key = merchant.toLowerCase().trim();
  for (const [word, category] of Object.entries(CATEGORY_MAP)) {
    if (key.includes(word)) return category;
  }
  return "Other";
}

// --- Marco ----------------------------------------------------------------

function parseWorkout(text: string): WorkoutIntent | null {
  const durationMinutes = extractDurationMinutes(text);
  const known = findFirst(text, WORKOUT_ACTIVITIES);
  const hasVerb = containsAny(text, WORKOUT_VERBS);

  // An activity word on its own is far too weak a signal: several of them
  // are ordinary English. "heard back from Globex" and "my back hurts" both
  // contain "back", and logging either as a Back workout is silent data
  // corruption the user then has to find and delete.
  //
  // A real log therefore needs a workout VERB ("did legs") or a DURATION
  // ("45 minutes legs"). Anything weaker is left to escalation, which can
  // read context this cannot.
  if (!hasVerb && durationMinutes === null) return null;

  // Past that gate, still require something nameable to log.
  if (!known && durationMinutes === null) return null;

  let activity = known;

  // No activity named separately, so fall back to the verb: "ran 30
  // minutes" is a run, not an unlabelled workout.
  if (!activity) {
    const verb = findFirst(text, Object.keys(VERB_ACTIVITIES));
    if (verb) activity = VERB_ACTIVITIES[verb.toLowerCase()];
  }

  if (!activity) {
    const trailing = text.match(
      /\b(?:of|doing)\s+([a-z\s-]+)$/i,
    );
    activity = trailing ? trailing[1].trim() : "Workout";
  }

  return {
    type: "log_workout",
    agent: "marco",
    activity: titleCase(activity),
    durationMinutes,
  };
}

// --- Lisa -----------------------------------------------------------------

function parseSchedule(text: string): ScheduleIntent | null {
  if (!containsAny(text, SCHEDULE_VERBS)) return null;

  const when = extractWhen(text);

  // "remind me to call the plumber at 5pm" -> title "call the plumber"
  let title = text;
  const reminder = text.match(
    /\b(?:remind me to|remember to|schedule|book|set up|add)\s+(.+)/i,
  );
  if (reminder) title = reminder[1];

  // Strip the trailing time phrase so it doesn't end up in the title.
  title = title
    .replace(/\b(?:at|on)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b.*$/i, "")
    .replace(/\b(?:tomorrow|today|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!title) return null;

  return { type: "schedule_event", agent: "lisa", title, when };
}

// --- Jarvis: questions ----------------------------------------------------

// Only phrasing that actually reads as a question, so "spent 12 on lunch"
// is never mistaken for one.
const QUESTION_SHAPE =
  /^(?:what'?s?|how|when|do i|can i|am i|should i|show me|tell me)\b|\?\s*$/i;

const QUESTION_TOPICS: { topic: QuestionTopic; pattern: RegExp }[] = [
  { topic: "runway", pattern: /runway|afford|how long.*(money|last|go)|burn rate|savings last/i },
  { topic: "pipeline", pattern: /appli|job|interview|pipeline|offer|hiring/i },
  { topic: "health", pattern: /workout|train|exercise|gym|fitness|run/i },
  { topic: "open_loops", pattern: /open|outstanding|to ?do|need|waiting|left/i },
];

function parseQuestion(text: string): QuestionIntent | null {
  if (!QUESTION_SHAPE.test(text.trim())) return null;

  for (const { topic, pattern } of QUESTION_TOPICS) {
    if (pattern.test(text)) return { type: "question", agent: "jarvis", topic };
  }
  return null;
}

// --- Vanessa: balance updates ---------------------------------------------

function parseSetBalance(text: string): SetBalanceIntent | null {
  const patterns = [
    /(?:set|update|change)\s+(.+?)\s+(?:to|at|=)\s*[£₹]?\s*([\d,]+(?:\.\d+)?)/i,
    /^(.+?)\s+(?:is|=)\s*[£₹]?\s*([\d,]+(?:\.\d+)?)\s*$/i,
    /^(.+?)\s+balance\s+(?:is\s+)?[£₹]?\s*([\d,]+(?:\.\d+)?)\s*$/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;

    const amount = Number(match[2].replace(/,/g, ""));
    if (!Number.isFinite(amount)) continue;

    const accountName = match[1].replace(/\bbalance\b/i, "").trim();
    if (!accountName) continue;

    return { type: "set_balance", agent: "vanessa", accountName, amount };
  }
  return null;
}

// "slept 7 hours", "7 hours of sleep", "got 6h30 last night". Requires an
// explicit sleep word AND a duration: a bare "7 hours" could be anything,
// and a bare "slept badly" is not a measurement.
const SLEEP_WORDS = /\b(slept|sleep|kip|nap|napped)\b/i;

function parseSleep(text: string): SleepIntent | null {
  if (!SLEEP_WORDS.test(text)) return null;
  const durationMinutes = extractDurationMinutes(text);
  if (durationMinutes === null || durationMinutes <= 0) return null;
  // A "nap" of nine hours is a night's sleep mis-heard; either way the
  // number is what matters, so nothing is rejected on length.
  return { type: "log_sleep", agent: "marco", durationMinutes };
}

// "ate chicken and rice", "had a salad for lunch". The verb has to be
// there and has to lead: "I had a call with Acme" is not a meal, so the
// verb must be followed by something that is not obviously another agent's
// business.
const MEAL_VERBS = /^(?:i\s+)?(?:ate|eaten|had|having|eating)\s+(.+)$/i;
const NOT_FOOD = /\b(call|meeting|interview|chat|word|look|think|thought|go|problem|issue|idea)\b/i;

function parseMeal(text: string): MealIntent | null {
  const cleaned = text.replace(/[.!?]+$/, "").trim();
  const match = cleaned.match(MEAL_VERBS);
  if (!match) return null;

  const what = match[1].trim();
  if (!what || NOT_FOOD.test(what)) return null;
  // "had 20 quid of petrol" is Vanessa's, not Marco's.
  if (extractMoney(what)?.amount != null) return null;

  const description = what.replace(/\s+for\s+(breakfast|lunch|dinner|tea|supper)$/i, "").trim();
  return { type: "log_meal", agent: "marco", description: description || what };
}

// A rename only ever fires when the thing being renamed actually resolves
// to an agent. That guard is what makes the loose "call X Y" phrasing safe
// to accept at all: "call the plumber at 5pm" tries every split of "plumber
// at 5pm", resolves none of them to an agent, and falls through to Lisa.
function parseRename(text: string): RenameIntent | null {
  const names = getAgentNames();
  const cleaned = text.replace(/[.!?]+$/, "").trim();

  // "rename job to Tony", "change the finances tab's name to Vanessa"
  const explicit = cleaned.match(
    /^(?:please\s+)?(?:rename|re-name|change|set)\s+(?:the\s+|my\s+)?(.+?)(?:\s+(?:agent|tab|screen|page))?(?:'s)?(?:\s+name)?\s+to\s+(.+)$/i,
  );
  if (explicit) {
    const target = resolveAgent(explicit[1], names);
    const name = normaliseAgentName(explicit[2]);
    if (target && name) return { type: "rename_agent", agent: "jarvis", target, name };
  }

  // "call health Marco", "name the job agent Applications"
  const verb = cleaned.match(/^(?:please\s+)?(?:call|name)\s+(?:the\s+|my\s+)?(.+)$/i);
  if (verb) {
    const words = verb[1].split(/\s+/);
    for (let i = 1; i < words.length; i++) {
      const left = words.slice(0, i).join(" ").replace(/\s+(?:agent|tab|screen|page)$/i, "");
      const target = resolveAgent(left, names);
      if (!target) continue;
      // "name the daily agent Today" splits before "agent", so the noun has
      // to come off whichever side of the split it landed on.
      const rest = words.slice(i).join(" ").replace(/^(?:agent|tab|screen|page)\s+/i, "");
      const name = normaliseAgentName(rest);
      if (name) return { type: "rename_agent", agent: "jarvis", target, name };
    }
  }

  return null;
}

// Ordered most-specific first: questions are checked before any capture so
// "how much have I spent" is never logged as an expense, and an utterance
// naming a company and a role is an application even though "for" also
// appears in expense phrasing.
const PARSERS = [
  parseRename,
  parseQuestion,
  parseApplication,
  parseIncome,
  parseExpense,
  parseSleep,
  parseMeal,
  parseWorkout,
  parseSetBalance,
  parseSchedule,
];

export function classifyUtterance(text: string): ParsedIntent {
  const trimmed = text.trim();
  if (!trimmed) return { type: "unhandled", agent: null, raw: trimmed };

  for (const parser of PARSERS) {
    const result = parser(trimmed);
    if (result) return result;
  }

  return { type: "unhandled", agent: null, raw: trimmed };
}

// Human-readable confirmation, shown after a capture so the user can see
// what was understood without opening the agent's screen.
export function describeIntent(intent: CaptureIntent): string {
  switch (intent.type) {
    case "log_application":
      return `Logged ${intent.company} - ${intent.role}`;
    case "log_expense":
      return `Logged ${formatMoney(intent.amount)} on ${intent.merchant}` +
        (intent.account ? ` (${intent.account})` : "");
    case "log_sleep":
      return `Logged ${Math.floor(intent.durationMinutes / 60)}h ${
        intent.durationMinutes % 60
      }m sleep`.replace(" 0m", "");
    case "log_meal":
      return `Logged ${intent.description}`;
    case "log_workout":
      return `Logged ${intent.activity}` +
        (intent.durationMinutes ? ` - ${intent.durationMinutes} min` : "");
    case "schedule_event":
      return `Saved "${intent.title}"` +
        (intent.when ? ` for ${intent.when.toLocaleString()}` : "");
    case "log_income":
      return `Income of ${formatMoney(intent.amount)} logged`;
    case "set_balance":
      return `${intent.accountName} updated to ${formatMoney(intent.amount)}`;
  }
}

export const AGENT_FOR_INTENT: Record<CaptureIntent["type"], AgentId> = {
  log_application: "tony",
  log_expense: "vanessa",
  log_income: "vanessa",
  log_workout: "marco",
  log_sleep: "marco",
  log_meal: "marco",
  schedule_event: "lisa",
  set_balance: "vanessa",
};
