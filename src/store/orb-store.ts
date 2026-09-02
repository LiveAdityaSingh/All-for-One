import { create } from "zustand";
import type { AgentId } from "@/lib/types";

// The orb's six states are the entire status system (build spec §5) -
// no spinners, no "thinking..." copy anywhere in the app.
export type OrbState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "delegating"
  | "celebrating";

interface OrbStoreState {
  state: OrbState;
  delegateTarget: AgentId | null;
  inputLevel: number; // 0-1, drives listening/speaking amplitude
  setState: (state: OrbState, delegateTarget?: AgentId | null) => void;
  setInputLevel: (level: number) => void;
}

export const useOrbStore = create<OrbStoreState>((set) => ({
  state: "idle",
  delegateTarget: null,
  inputLevel: 0,
  setState: (state, delegateTarget = null) => set({ state, delegateTarget }),
  setInputLevel: (inputLevel) => set({ inputLevel }),
}));
