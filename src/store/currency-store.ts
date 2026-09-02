import { create } from "zustand";
import { getCurrency, type CurrencyCode } from "@/lib/locale";

// Currency lives in localStorage, which does not exist when these pages'
// HTML is generated at build time. Reading it during render therefore
// makes the first client render disagree with the server output, which
// React reports as a hydration mismatch (#418).
//
// So components read it from here instead: the store starts on the same
// value the build used, and AppBootstrap syncs the real one after mount.
interface CurrencyState {
  code: CurrencyCode;
  sync: () => void;
}

export const useCurrencyStore = create<CurrencyState>((set) => ({
  code: "GBP",
  sync: () => set({ code: getCurrency() }),
}));
