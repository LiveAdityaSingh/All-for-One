import { create } from "zustand";
import type { UndoStep } from "@/lib/capture";

// The confirmation is shown on the screen where you spoke, but a capture
// hands off to the owning agent 1.4s later - so the undo has to outlive that
// navigation. Keeping it here rather than in component state means the
// button is still there when you arrive and realise it misheard you.
interface UndoState {
  message: string | null;
  steps: UndoStep[] | null;
  offer: (message: string, steps: UndoStep[]) => void;
  clear: () => void;
}

export const useUndoStore = create<UndoState>((set) => ({
  message: null,
  steps: null,
  offer: (message, steps) => set({ message, steps }),
  clear: () => set({ message: null, steps: null }),
}));
