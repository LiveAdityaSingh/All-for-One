"use client";

import { useCurrencyStore } from "@/store/currency-store";
import { formatMoneyIn } from "./locale";

// Money formatting for React components. Bound to the store rather than to
// localStorage so the first render matches the build-time HTML and updates
// only after the real setting is synced.
export function useMoney() {
  const code = useCurrencyStore((s) => s.code);
  return {
    formatMoney: (value: number, decimals = 2) => formatMoneyIn(code, value, decimals),
    formatMoneyRounded: (value: number) => formatMoneyIn(code, Math.round(value), 0),
  };
}
