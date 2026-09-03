// What each agent is called on screen.
//
// The app ships with plain descriptions of what a screen is for rather
// than character names: "Tony" only means something once you already know
// the app, while "Job" tells a first-time user what they are looking at.
// The character names stay available as a one-tap preset for anyone who
// prefers them, and any name can be replaced with the user's own.
//
// Only the display name is configurable. The ids below are structural -
// they key the colour tokens, the routes and every stored record - so
// renaming is always cosmetic and can never orphan data.
import type { AgentId } from "./types";

// Tab order, which is also the order these appear in Settings.
export const AGENT_IDS: AgentId[] = ["tony", "lisa", "jarvis", "vanessa", "marco"];

export type AgentNames = Record<AgentId, string>;

export const DEFAULT_AGENT_NAMES: AgentNames = {
  jarvis: "Home",
  tony: "Job",
  lisa: "Daily",
  vanessa: "Finances",
  marco: "Health",
};

export const CHARACTER_NAMES: AgentNames = {
  jarvis: "Jarvis",
  tony: "Tony",
  lisa: "Lisa",
  vanessa: "Vanessa",
  marco: "Marco",
};

const KEY = "agent_names";

// Five of these sit side by side in the tab bar on a phone. Longer than
// this and the labels wrap, which breaks the row.
export const MAX_AGENT_NAME = 14;

// Deliberately permissive about script - someone should be able to name an
// agent in their own language - but no punctuation that could be mistaken
// for markup.
const ALLOWED = /^[\p{L}\p{N} '&.-]+$/u;

export function normaliseAgentName(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed.length > MAX_AGENT_NAME) return null;
  if (!ALLOWED.test(trimmed)) return null;
  return trimmed;
}

// Only overrides are stored, never the full set. That way a change to a
// default name still reaches everyone who never renamed that agent.
export function getAgentNameOverrides(): Partial<AgentNames> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    const out: Partial<AgentNames> = {};
    for (const id of AGENT_IDS) {
      const value = (parsed as Record<string, unknown>)[id];
      if (typeof value !== "string") continue;
      const clean = normaliseAgentName(value);
      if (clean) out[id] = clean;
    }
    return out;
  } catch {
    // A corrupt or unreadable value should cost the custom names, not the
    // app: fall back to defaults rather than throwing during render.
    return {};
  }
}

export function getAgentNames(): AgentNames {
  return { ...DEFAULT_AGENT_NAMES, ...getAgentNameOverrides() };
}

function persist(overrides: Partial<AgentNames>): AgentNames {
  if (typeof window !== "undefined") {
    try {
      if (Object.keys(overrides).length === 0) window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, JSON.stringify(overrides));
    } catch {
      // Private-mode quota failures leave the name unchanged rather than
      // taking down the settings screen.
    }
  }
  return { ...DEFAULT_AGENT_NAMES, ...overrides };
}

// Passing null clears the override, which restores the shipped default.
export function writeAgentName(id: AgentId, name: string | null): AgentNames {
  const overrides = getAgentNameOverrides();
  const clean = name === null ? null : normaliseAgentName(name);

  if (clean === null || clean === DEFAULT_AGENT_NAMES[id]) delete overrides[id];
  else overrides[id] = clean;

  return persist(overrides);
}

export function writeAllAgentNames(names: Partial<AgentNames>): AgentNames {
  const overrides: Partial<AgentNames> = {};
  for (const id of AGENT_IDS) {
    const clean = names[id] ? normaliseAgentName(names[id] as string) : null;
    if (clean && clean !== DEFAULT_AGENT_NAMES[id]) overrides[id] = clean;
  }
  return persist(overrides);
}

// Two agents answering to the same word would make every spoken rename
// ambiguous, so the caller has to be able to check first.
export function nameClash(names: AgentNames, id: AgentId, candidate: string): AgentId | null {
  const needle = candidate.toLowerCase();
  for (const other of AGENT_IDS) {
    if (other === id) continue;
    if (names[other].toLowerCase() === needle) return other;
  }
  return null;
}

// Which agent someone means when they say a word out loud. Their own name
// wins, then the shipped default, then the character name, then the id -
// so "rename Tony to Work" keeps working after Tony has become "Job".
export function resolveAgent(text: string, names: AgentNames = getAgentNames()): AgentId | null {
  const needle = text.trim().toLowerCase().replace(/\s+/g, " ");
  if (!needle) return null;

  for (const table of [names, DEFAULT_AGENT_NAMES, CHARACTER_NAMES]) {
    for (const id of AGENT_IDS) {
      if (table[id].toLowerCase() === needle) return id;
    }
  }
  return AGENT_IDS.find((id) => id === needle) ?? null;
}
