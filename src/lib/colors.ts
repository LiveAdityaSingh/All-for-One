import { formatHex, oklch } from "culori";
import type { AgentId } from "./types";

// Single source of truth for the OKLCH colour system (build spec §4):
// locked lightness/chroma, hue is the only thing that changes per agent.
// CSS reads this directly via oklch() in globals.css; anything that needs
// a plain RGB number (Three.js materials) converts through here instead
// of hard-coding a second copy of these values.
const AGENT_HUES: Record<AgentId, number> = {
  marco: 15,
  tony: 75,
  jarvis: 155,
  lisa: 250,
  vanessa: 300,
};

const LOCKED_L = 0.62;
const LOCKED_C = 0.13;

export function agentHex(agent: AgentId, chromaRatio = 1): string {
  const hex = formatHex(
    oklch({ mode: "oklch", l: LOCKED_L, c: LOCKED_C * chromaRatio, h: AGENT_HUES[agent] }),
  );
  return hex ?? "#888888";
}

export const AGENT_HEX = {
  jarvis: agentHex("jarvis"),
  tony: agentHex("tony"),
  lisa: agentHex("lisa"),
  vanessa: agentHex("vanessa"),
  marco: agentHex("marco"),
} as const;
