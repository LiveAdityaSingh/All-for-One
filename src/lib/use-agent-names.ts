"use client";

import type { AgentId } from "./types";
import { useAgentNamesStore } from "@/store/agent-names-store";

// Bound to the store rather than to localStorage so the first render
// matches the build-time HTML and updates only once the real names sync.
export function useAgentNames() {
  return useAgentNamesStore((s) => s.names);
}

export function useAgentName(id: AgentId) {
  return useAgentNamesStore((s) => s.names[id]);
}
