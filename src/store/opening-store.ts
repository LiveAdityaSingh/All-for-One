import { create } from "zustand";

// Whether the app is ready to be looked at. Set once, from AppBootstrap,
// after hydration and the first round of setup - which is as close to
// "usable" as the app can honestly signal.
interface OpeningState {
  ready: boolean;
  markReady: () => void;
}

export const useOpeningStore = create<OpeningState>((set) => ({
  ready: false,
  markReady: () => set({ ready: true }),
}));
