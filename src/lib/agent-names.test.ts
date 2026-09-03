import { beforeEach, describe, expect, it } from "vitest";
import {
  CHARACTER_NAMES,
  DEFAULT_AGENT_NAMES,
  getAgentNames,
  nameClash,
  normaliseAgentName,
  resolveAgent,
  writeAgentName,
  writeAllAgentNames,
} from "./agent-names";
import { classifyUtterance } from "./intent";

// The suite runs in the node environment, so the browser storage these
// names live in has to be stood up before the module under test reads it.
class MemoryStorage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, String(v)); }
  removeItem(k: string) { this.data.delete(k); }
  clear() { this.data.clear(); }
}

Object.defineProperty(globalThis, "window", {
  value: { localStorage: new MemoryStorage() },
  configurable: true,
  writable: true,
});

beforeEach(() => {
  window.localStorage.clear();
});

describe("names", () => {
  it("ships with what the screen is for, not who it is", () => {
    expect(getAgentNames()).toEqual({
      jarvis: "Home",
      tony: "Job",
      lisa: "Daily",
      vanessa: "Finances",
      marco: "Health",
    });
  });

  it("keeps a custom name and leaves the rest alone", () => {
    const names = writeAgentName("tony", "Applications");
    expect(names.tony).toBe("Applications");
    expect(names.lisa).toBe("Daily");
    expect(getAgentNames().tony).toBe("Applications");
  });

  it("clearing a name restores the shipped default", () => {
    writeAgentName("tony", "Applications");
    expect(writeAgentName("tony", null).tony).toBe("Job");
  });

  // Only overrides are stored, so a later change to a default still reaches
  // anyone who never renamed that agent.
  it("does not store a name that equals the default", () => {
    writeAgentName("tony", "Job");
    expect(window.localStorage.getItem("agent_names")).toBeNull();
  });

  it("rejects empty, overlong and markup-ish names", () => {
    expect(normaliseAgentName("   ")).toBeNull();
    expect(normaliseAgentName("a".repeat(15))).toBeNull();
    expect(normaliseAgentName("<script>")).toBeNull();
    expect(normaliseAgentName("  Job   Search ")).toBe("Job Search");
  });

  it("survives a corrupt stored value", () => {
    window.localStorage.setItem("agent_names", "{not json");
    expect(getAgentNames()).toEqual(DEFAULT_AGENT_NAMES);
  });

  it("spots a clash with another agent", () => {
    expect(nameClash(getAgentNames(), "tony", "Daily")).toBe("lisa");
    expect(nameClash(getAgentNames(), "tony", "Applications")).toBeNull();
  });
});

describe("resolving which agent someone means", () => {
  it("matches the default, the character name and the id", () => {
    expect(resolveAgent("Job")).toBe("tony");
    expect(resolveAgent("tony")).toBe("tony");
    expect(resolveAgent("  FINANCES ")).toBe("vanessa");
    expect(resolveAgent("plumber")).toBeNull();
  });

  it("still answers to its old name after a rename", () => {
    writeAllAgentNames(CHARACTER_NAMES);
    expect(resolveAgent("Tony")).toBe("tony");
    expect(resolveAgent("Job")).toBe("tony");
  });
});

describe("renaming out loud", () => {
  it("understands the explicit forms", () => {
    expect(classifyUtterance("rename Job to Tony")).toMatchObject({
      type: "rename_agent",
      target: "tony",
      name: "Tony",
    });
    expect(classifyUtterance("change the finances tab's name to Vanessa")).toMatchObject({
      type: "rename_agent",
      target: "vanessa",
      name: "Vanessa",
    });
  });

  it("understands the loose forms", () => {
    expect(classifyUtterance("call health Marco")).toMatchObject({
      type: "rename_agent",
      target: "marco",
      name: "Marco",
    });
    expect(classifyUtterance("name the daily agent Today")).toMatchObject({
      type: "rename_agent",
      target: "lisa",
      name: "Today",
    });
  });

  // The whole safety argument for accepting "call X Y" at all: it only
  // fires when X actually resolves to an agent.
  it("never steals an ordinary utterance", () => {
    expect(classifyUtterance("remind me to call the plumber at 5pm").type).toBe(
      "schedule_event",
    );
    expect(classifyUtterance("call the plumber at 5pm").type).not.toBe("rename_agent");
    expect(classifyUtterance("spent 12 quid on lunch").type).toBe("log_expense");
    expect(classifyUtterance("set Monzo to 1200").type).not.toBe("rename_agent");
    expect(classifyUtterance("what's my runway?").type).toBe("question");
  });

  it("refuses a name it could not store", () => {
    expect(classifyUtterance("rename Job to <b>").type).not.toBe("rename_agent");
  });
});
