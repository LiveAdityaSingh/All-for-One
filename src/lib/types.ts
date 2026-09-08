// Every stored record carries this, stamped automatically on every write.
// Without it two devices cannot tell whose copy of a record is newer, which
// is what makes any future sync possible - and it is far cheaper to add now
// than to backfill once there are months of data.
export interface Synced {
  modifiedAt?: string; // ISO
}

// Deleting a record has to leave a trace. Otherwise "deleted on the phone"
// and "not yet created on the laptop" look identical, and any merge would
// quietly resurrect things the user threw away.
export interface Deletion {
  id: string; // the deleted record's id
  table: string;
  deletedAt: string;
}

// Agent identity, shared across the whole app (build spec §2, §4).
export type AgentId = "jarvis" | "tony" | "lisa" | "vanessa" | "marco";

// --- Voice/text captures --------------------------------------------------

// Captures for agents whose own surfaces ship in later phases (Lisa §7,
// Vanessa §8, Marco §9) land here. Voice capture has to work offline and
// queue locally (build spec §12), so the parse result is always written
// to the device first; nothing waits on a network round-trip.
// Sleep and meals join workouts as things Marco reasons about: a body
// score built on training alone would be a training score wearing a
// health label.
export type CaptureKind = "expense" | "workout" | "event" | "sleep" | "meal";

export interface Capture extends Synced {
  id: string;
  kind: CaptureKind;
  agent: AgentId;
  // What the user actually said, kept verbatim so a mis-parse is always
  // recoverable - the parser's reading is never the only record.
  raw: string;
  label: string;
  // Kind-specific values, all optional because the parser returns null
  // rather than guessing at anything it couldn't read confidently.
  amount?: number;
  currency?: string;
  account?: string | null;
  durationMinutes?: number | null;
  scheduledFor?: string | null; // ISO date
  capturedAt: string; // ISO date
}

// --- Vanessa: finances (build spec §8) ------------------------------------

// The user adds as many accounts as they have and assigns a purpose to
// each. This is mental accounting (Thaler): people already earmark money
// by purpose, and forcing one undifferentiated pool fights that.
export interface Account extends Synced {
  id: string;
  name: string;
  goal: string;
  balance: number;
  currency: "GBP";
  updatedAt: string; // ISO; drives the staleness state
  createdAt: string;
}

// Transactions-first money manager: income and expenses are recorded
// individually and rolled up per period, alongside the balance loop.
export type TransactionType = "income" | "expense";

export interface Transaction extends Synced {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  accountId: string | null;
  note: string;
  occurredAt: string; // ISO
}

// Simple key/value store for user preferences that need to be reactive
// (the monthly limit is read on every render of the finance screen).
export interface Setting {
  key: string;
  value: string;
}

export const SPEND_CATEGORIES = [
  "Groceries", "Eating out", "Transport", "Rent", "Bills", "Shopping",
  "Health", "Entertainment", "Travel", "Subscriptions", "Other",
] as const;

// Balance history is what runway is derived from. Burn deliberately does
// not come from logged expenses: expense logging is optional texture
// (build spec §8), so anything load-bearing built on it would silently
// mislead the moment the user stops logging.
export interface BalanceSnapshot extends Synced {
  id: string;
  accountId: string;
  balance: number;
  recordedAt: string;
}

// The body you are scoring against. Height and sex barely change, weight
// does, so this is a single living record rather than a log - the point is
// "what am I now", not a history of measurements.
//
// Deliberately small: every field here is one the score actually uses, so
// nothing is asked for that does not earn its place on the form. Lives on
// the device with everything else and travels only in a backup the user
// exports themselves.
export type Sex = "female" | "male" | "unspecified";

export interface BodyMetrics extends Synced {
  id: string; // always PROFILE_ID - there is one body
  heightCm: number | null;
  weightKg: number | null;
  birthYear: number | null;
  sex: Sex;
  updatedAt: string;
}

export const PROFILE_ID = "me";

// --- Lisa: scheduling (build spec §7) -------------------------------------

// Daily, monthly, repeating and one-off tasks, plus milestones.
// "habit" is the flexible one: you choose which weekdays it applies to and
// how many times you mean to do it on each of them. "daily" and "monthly"
// remain as the two rhythms common enough to be worth a preset.
export type TaskKind = "one_off" | "habit" | "daily" | "monthly" | "milestone";

export interface Task extends Synced {
  id: string;
  title: string;
  kind: TaskKind;
  // Habits only. Weekdays are 0-6 with 0 as Sunday, matching Date.getDay,
  // so a habit can be "weekdays only" or "Tuesdays and Thursdays" rather
  // than every day or nothing.
  weekdays?: number[] | null;
  timesPerDay?: number | null;
  // Consecutive applicable days completed, and the day it last grew. Kept
  // as a running count rather than derived, because the app stores no
  // per-day history to derive it from.
  streak?: number;
  streakDay?: string | null; // YYYY-MM-DD
  // How many of today's repetitions are done. Only meaningful while
  // lastCompletedOn is today; any other date means the count is stale and
  // reads as zero, which is what makes the reset need no background job.
  completedToday?: number;
  dueAt: string | null; // ISO date; null for undated daily habits
  completedAt: string | null;
  // For repeating tasks, the last date it was ticked off, so a daily task
  // can reset each day without losing its history.
  lastCompletedOn: string | null; // YYYY-MM-DD
  createdAt: string;
}

export const TASK_KIND_LABELS: Record<TaskKind, string> = {
  one_off: "Once",
  habit: "Habit",
  daily: "Daily",
  monthly: "Monthly",
  milestone: "Milestone",
};

// What the picker says when you are about to make one. A habit is the only
// kind whose name changes with tense: you create "a new habit", and what
// you end up with is "a habit".
export const TASK_KIND_PICKER_LABELS: Record<TaskKind, string> = {
  ...TASK_KIND_LABELS,
  habit: "New habit",
};

export const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"] as const;
export const WEEKDAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
] as const;

// --- Tony: job applications (build spec §6) -------------------------------

export type ApplicationStage =
  | "applied"
  | "recruiter_screen"
  | "interviewed"
  | "final_stage"
  | "offer"
  | "rejected"
  | "withdrawn";

// Ghosting decay only ever walks a live application through these states.
// "presumed_closed" is terminal until the user undoes it.
export type LifecycleStatus = "active" | "stale" | "presumed_closed";

export interface JobApplication extends Synced {
  id: string;
  company: string;
  role: string;
  stage: ApplicationStage;
  lifecycleStatus: LifecycleStatus;
  cvVariantId: string | null;
  appliedAt: string; // ISO date
  stageEnteredAt: string; // ISO date - when `stage` was last set
  lastNudgedAt: string | null;
  nudgesIgnored: number; // consecutive dismissed/ignored nudges at current stage
  notes: string;
}

export interface CvVariant extends Synced {
  id: string;
  name: string; // e.g. "AI Engineer", "Data Scientist"
  createdAt: string;
}

// A single confirmed fact about the user. Tony may only draft CV bullets
// from claims with confirmed === true (build spec §6, verified claims ledger).
export interface Claim extends Synced {
  id: string;
  text: string;
  confirmed: boolean;
  createdAt: string;
}

// Per-stage nudge timers, in days. All user-editable (build spec §6).
export const DEFAULT_STAGE_TIMERS_DAYS: Record<ApplicationStage, number | null> = {
  applied: 12,
  recruiter_screen: 7,
  interviewed: 5,
  final_stage: 3,
  offer: null,
  rejected: null,
  withdrawn: null,
};

export const STAGE_LABELS: Record<ApplicationStage, string> = {
  applied: "Applied",
  recruiter_screen: "Recruiter screen",
  interviewed: "Interviewed",
  final_stage: "Final stage",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};
