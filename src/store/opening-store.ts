import { create } from "zustand";

// Whether the app is ready to be looked at. Set once, from AppBootstrap,
// after hydration and the first round of setup - which is as close to
// "usable" as the app can honestly signal.
interface OpeningState {
  ready: boolean;
  markReady: () => void;
  // The walkthrough waits for the first-run orb to finish rather than
  // starting on top of it.
  introDone: boolean;
  markIntroDone: () => void;
}

export const useOpeningStore = create<OpeningState>((set) => ({
  ready: false,
  markReady: () => set({ ready: true }),
  introDone: false,
  markIntroDone: () => set({ introDone: true }),
}));
