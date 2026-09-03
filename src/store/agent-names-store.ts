import { create } from "zustand";
import type { AgentId } from "@/lib/types";
import {
  DEFAULT_AGENT_NAMES,
  getAgentNames,
  writeAgentName,
  writeAllAgentNames,
  type AgentNames,
} from "@/lib/agent-names";

// Same reasoning as the currency store: names live in localStorage, which
// does not exist when these pages' HTML is generated at build time, so
// reading during render would make the first client render disagree with
// the server output (React #418). Components read from here instead - the
// store starts on the shipped defaults, exactly what the build used, and
// AppBootstrap syncs the user's real names after mount.
interface AgentNamesState {
  names: AgentNames;
  sync: () => void;
  rename: (id: AgentId, name: string | null) => void;
  applyAll: (names: Partial<AgentNames>) => void;
}

export const useAgentNamesStore = create<AgentNamesState>((set) => ({
  names: DEFAULT_AGENT_NAMES,
  sync: () => set({ names: getAgentNames() }),
  rename: (id, name) => set({ names: writeAgentName(id, name) }),
  applyAll: (names) => set({ names: writeAllAgentNames(names) }),
}));
