// Shared value extractors for the on-device parser. Each returns null
// rather than guessing - a wrong amount silently logged is worse than no
// capture, because the user won't know to correct it.
import {
  HOUR_WORDS,
  INCOME_VERBS,
  MINUTE_WORDS,
  SCALE_WORDS,
  TENS,
  UNITS,
  WEEKDAYS,
} from "./lexicon";
import type { CurrencyCode } from "@/lib/locale";

// "forty" -> 40, "forty five" / "forty-five" -> 45, "12" -> 12.
export function parseNumberWords(text: string): number | null {
  const digits = text.match(/\d+(?:\.\d+)?/);
  if (digits) return Number(digits[0]);

  const words = text.toLowerCase().split(/[\s-]+/).filter(Boolean);
  let total: number | null = null;

  for (const word of words) {
    if (word in TENS) {
      total = (total ?? 0) + TENS[word];
    } else if (word in UNITS) {
      total = (total ?? 0) + UNITS[word];
    } else if (total !== null) {
      break; // stop at the first non-number word after a number started
    }
  }

  return total;
}

export interface Money {
  amount: number;
  // Which currency the user actually said, when they said one at all.
  // Amounts are stored as bare numbers so totals can be summed, but
  // discarding this outright would let the app quietly disagree with a
  // word the user chose deliberately - and pounds and rupees differ by
  // roughly a hundredfold.
  spoken: CurrencyCode | null;
}

// A trailing "lakh" or "crore" multiplies whatever preceded it. Indian
// English uses these constantly and no recogniser turns them into digits.
function applyScale(value: number, text: string, after: number): number {
  const tail = text.slice(after, after + 24).toLowerCase();
  for (const [word, multiplier] of Object.entries<number>(SCALE_WORDS)) {
    if (new RegExp(`^\\s*${word}\\b`).test(tail)) return value * multiplier;
  }
  return value;
}

// Handles "£12.50", "40 quid", "twelve pounds", "spent 8 on lunch",
// "₹500", "500 rupees", "Rs 250", "2 lakh", "1.5 crore".
export function extractMoney(text: string): Money | null {
  const symbol = text.match(/([£₹])\s*(\d+(?:\.\d+)?)/);
  if (symbol) {
    return {
      amount: applyScale(Number(symbol[2]), text, symbol.index! + symbol[0].length),
      spoken: symbol[1] === "₹" ? "INR" : "GBP",
    };
  }

  // "Rs 250" and "Rs. 250" put the unit BEFORE the number, unlike £ or "quid".
  const prefixed = text.match(/\brs\.?\s*(\d+(?:\.\d+)?)/i);
  if (prefixed) {
    return {
      amount: applyScale(Number(prefixed[1]), text, prefixed.index! + prefixed[0].length),
      spoken: "INR",
    };
  }

  const worded = text.match(
    /(\d+(?:\.\d+)?|[a-z\s-]+?)\s*(quid|pounds?|gbp|rupees?|inr)\b/i,
  );
  if (worded) {
    const value = parseNumberWords(worded[1]);
    if (value !== null) {
      return {
        amount: applyScale(value, text, worded.index! + worded[0].length),
        spoken: /rup|inr/i.test(worded[2]) ? "INR" : "GBP",
      };
    }
  }

  // A scale word with no currency word at all: "spent 2 lakh on the wedding".
  const scaled = text.match(
    new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${Object.keys(SCALE_WORDS).join("|")})\\b`, "i"),
  );
  if (scaled) {
    return { amount: Number(scaled[1]) * SCALE_WORDS[scaled[2].toLowerCase()], spoken: null };
  }

  // Bare number following a spend verb: "spent 40 on groceries".
  const bare = text.match(
    /\b(?:spent|spend|paid|bought|logged|log|cost|charged)\s+(\d+(?:\.\d+)?|[a-z-]+(?:\s+[a-z-]+)?)\s+(?:on|at|for)\b/i,
  );
  if (bare) {
    const value = parseNumberWords(bare[1]);
    if (value !== null) {
      return { amount: applyScale(value, text, bare.index! + bare[0].length), spoken: null };
    }
  }

  // Bare number following an income verb: "earned 2000", "got paid 1800".
  // Income has no trailing "on <thing>" the way spending does, so it needs
  // its own pattern - without it any income phrased without a currency
  // word is silently dropped.
  const earned = text.match(
    new RegExp(`\\b(?:${INCOME_VERBS.join("|")})\\s+£?\\s*(\\d+(?:\\.\\d+)?|[a-z-]+(?:\\s+[a-z-]+)?)\\b`, "i"),
  );
  if (earned) {
    const value = parseNumberWords(earned[1]);
    if (value !== null) return { amount: value, spoken: null };
  }

  return null;
}

// Handles "45 minutes", "1 hour 30", "90 mins", "an hour".
export function extractDurationMinutes(text: string): number | null {
  const lower = text.toLowerCase();

  // The quantity may only be digits or an actual number word. A looser
  // "any word or two" group swallows whatever precedes the unit - in
  // "cycled an hour" it captures "cycled an", which parses as no number
  // at all and loses the duration.
  const numberWords = [...Object.keys(TENS), ...Object.keys(UNITS), "an", "a"];
  const QUANTITY =
    `(\\d+(?:\\.\\d+)?|(?:${numberWords.join("|")})(?:[\\s-]+(?:${numberWords.join("|")}))?)`;

  // The unit must also not be glued to the end of a preceding word: in
  // "swam 40 minutes" the "m" of "swam" would otherwise match as the unit.
  // A digit before the unit is still fine, so "40m" keeps working.
  const NOT_MID_WORD = "(?<![a-z])";

  const hourPattern = new RegExp(
    `${QUANTITY}\\s*${NOT_MID_WORD}(?:${HOUR_WORDS.join("|")})\\b`,
    "i",
  );
  const minutePattern = new RegExp(
    `${QUANTITY}\\s*${NOT_MID_WORD}(?:${MINUTE_WORDS.join("|")})\\b`,
    "i",
  );

  let minutes: number | null = null;

  const hours = lower.match(hourPattern);
  if (hours) {
    const value = /^an?$/.test(hours[1].trim())
      ? 1
      : parseNumberWords(hours[1]);
    if (value !== null) minutes = value * 60;
  }

  const mins = lower.match(minutePattern);
  if (mins) {
    const value = parseNumberWords(mins[1]);
    if (value !== null) minutes = (minutes ?? 0) + value;
  } else if (hours) {
    // "1 hour 30" - people routinely drop the trailing unit in speech.
    const barePattern = new RegExp(
      `${NOT_MID_WORD}(?:${HOUR_WORDS.join("|")})\\s+${QUANTITY}\\b`,
      "i",
    );
    const bare = lower.match(barePattern);
    const value = bare ? parseNumberWords(bare[1]) : null;
    if (value !== null && value < 60) minutes = (minutes ?? 0) + value;
  }

  return minutes;
}

// Handles "at 7pm", "at 19:30", "tomorrow at 9", "monday at 8am".
// Resolves against `now` so "monday" always means the next monday.
export function extractWhen(text: string, now: Date = new Date()): Date | null {
  const lower = text.toLowerCase();

  const clock = lower.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  // No leading \b before am/pm: in "9am" the digit and the "a" are both
  // word characters, so a boundary never matches there.
  const hasTimeWord = /\d\s*(?:am|pm)\b|o'?clock|\d:\d{2}/.test(lower);
  if (!clock || !hasTimeWord) return resolveDayOnly(lower, now);

  let hour = Number(clock[1]);
  const minute = clock[2] ? Number(clock[2]) : 0;
  const meridiem = clock[3];

  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;

  const base = resolveDayOnly(lower, now) ?? new Date(now);
  base.setHours(hour, minute, 0, 0);

  // A bare time that has already passed today means tomorrow.
  if (!/\b(tomorrow|today|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/.test(lower)
    && base.getTime() <= now.getTime()) {
    base.setDate(base.getDate() + 1);
  }

  return base;
}

function resolveDayOnly(lower: string, now: Date): Date | null {
  if (/\btomorrow\b/.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d;
  }

  if (/\btoday\b/.test(lower)) {
    const d = new Date(now);
    d.setHours(9, 0, 0, 0);
    return d;
  }

  for (const [name, index] of Object.entries(WEEKDAYS)) {
    if (new RegExp(`\\b${name}\\b`).test(lower)) {
      const d = new Date(now);
      const delta = (index - d.getDay() + 7) % 7 || 7;
      d.setDate(d.getDate() + delta);
      d.setHours(9, 0, 0, 0);
      return d;
    }
  }

  return null;
}
