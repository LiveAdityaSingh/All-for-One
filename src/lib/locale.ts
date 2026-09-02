// Speech recognition and currency are per-user settings, not constants.
//
// The recogniser takes ONE BCP-47 tag per session, so this cannot be
// automatic: "spent five hundred on Swiggy" and "spent a fiver at Pret"
// need different acoustic models, and guessing wrong degrades every
// capture. The user picks once.
//
// Currency is deliberately single-valued too. Runway, net and category
// shares all sum amounts together, and without exchange rates - which
// would need a network and a source of truth this app does not have -
// adding rupees to pounds produces a number that looks precise and means
// nothing. One currency per user is honest; a mixed total is not.

export type SpeechLocale = "en-GB" | "en-IN" | "en-US";
export type CurrencyCode = "GBP" | "INR";

const LOCALE_KEY = "speech_locale";
const CURRENCY_KEY = "currency_code";

export const SPEECH_LOCALES: { value: SpeechLocale; label: string }[] = [
  { value: "en-GB", label: "English (UK)" },
  { value: "en-IN", label: "English (India)" },
  { value: "en-US", label: "English (US)" },
];

export const CURRENCIES: { value: CurrencyCode; label: string; symbol: string }[] = [
  { value: "GBP", label: "Pounds (£)", symbol: "£" },
  { value: "INR", label: "Rupees (₹)", symbol: "₹" },
];

const SYMBOLS: Record<CurrencyCode, string> = { GBP: "£", INR: "₹" };

export const CURRENCY_NAMES: Record<CurrencyCode, string> = {
  GBP: "pounds",
  INR: "rupees",
};

function deviceDefaults(): { locale: SpeechLocale; currency: CurrencyCode } {
  if (typeof navigator === "undefined") return { locale: "en-GB", currency: "GBP" };
  const tag = (navigator.language || "").toLowerCase();
  if (tag.startsWith("en-in") || tag.endsWith("-in")) {
    return { locale: "en-IN", currency: "INR" };
  }
  if (tag.startsWith("en-us")) return { locale: "en-US", currency: "GBP" };
  return { locale: "en-GB", currency: "GBP" };
}

export function getSpeechLocale(): SpeechLocale {
  if (typeof window === "undefined") return "en-GB";
  const stored = window.localStorage.getItem(LOCALE_KEY) as SpeechLocale | null;
  return stored ?? deviceDefaults().locale;
}

export function setSpeechLocale(locale: SpeechLocale): void {
  window.localStorage.setItem(LOCALE_KEY, locale);
}

export function getCurrency(): CurrencyCode {
  if (typeof window === "undefined") return "GBP";
  const stored = window.localStorage.getItem(CURRENCY_KEY) as CurrencyCode | null;
  return stored ?? deviceDefaults().currency;
}

export function setCurrency(code: CurrencyCode): void {
  window.localStorage.setItem(CURRENCY_KEY, code);
}

export function currencySymbol(): string {
  return SYMBOLS[getCurrency()];
}

// Indian digit grouping is 2,2,3 (12,34,567) rather than 3,3,3, so the
// number itself is formatted differently, not just the symbol.
export function formatMoney(value: number, decimals = 2): string {
  const code = getCurrency();
  const grouping = code === "INR" ? "en-IN" : "en-GB";
  return (
    SYMBOLS[code] +
    value.toLocaleString(grouping, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  );
}

// Rounded form for headline figures where pennies are noise.
export function formatMoneyRounded(value: number): string {
  return formatMoney(Math.round(value), 0);
}

// Formatting bound to a currency passed in, for React components that read
// the code from the store rather than from localStorage during render.
export function formatMoneyIn(code: CurrencyCode, value: number, decimals = 2): string {
  const grouping = code === "INR" ? "en-IN" : "en-GB";
  return (
    SYMBOLS[code] +
    value.toLocaleString(grouping, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  );
}
