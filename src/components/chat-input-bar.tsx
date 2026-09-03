"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { captureUtterance } from "@/lib/capture";
import { getSpeechLocale } from "@/lib/locale";
import { useAgentName } from "@/lib/use-agent-names";
import type { Answer } from "@/lib/cross-agent";
import { ensureNotificationPermission } from "@/lib/notifications";
import { useOrbStore } from "@/store/orb-store";
import { useUndoStore } from "@/store/undo-store";
import { UndoBar } from "@/components/undo-bar";
import type { AgentId } from "@/lib/types";

interface ChatInputBarProps {
  // "jarvis" renders the full-width primary bar on the landing screen.
  // "agent" renders inside another agent's room, with the small emerald
  // Jarvis dot alongside it so voice never requires navigating home
  // (build spec §5).
  variant: "jarvis" | "agent";
  // A concrete example rather than "log something": the parser accepts a
  // specific shape, and showing it is what teaches the format.
  placeholder?: string;
}

// The whole product assumes people know what they can say. On Jarvis's
// screen there is no agent context to hint at it, so the placeholder
// cycles one example per agent - that rotation is the only place the
// app teaches its own vocabulary.
const ROTATING_EXAMPLES = [
  "e.g. applied to Acme for Data Scientist",
  "e.g. spent 12 quid on lunch, Monzo",
  "e.g. did 45 minutes legs",
  "e.g. remind me to call the plumber at 5pm",
  "e.g. what's my runway?",
];

const ROTATE_MS = 4000;

// Minimal Web Speech API surface - not in lib.dom.d.ts by default.
interface SpeechRecognitionResultLike {
  results: { 0: { transcript: string } }[];
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  start: () => void;
  onresult: ((event: SpeechRecognitionResultLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

function getSpeechRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export function ChatInputBar({ variant, placeholder }: ChatInputBarProps) {
  const homeName = useAgentName("jarvis");
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [exampleIndex, setExampleIndex] = useState(0);

  const rotating = variant === "jarvis" && !placeholder;

  useEffect(() => {
    if (!rotating) return;
    // Text changing on its own is motion; anyone who has asked for less of
    // it keeps the first example instead.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const id = window.setInterval(
      () => setExampleIndex((i) => (i + 1) % ROTATING_EXAMPLES.length),
      ROTATE_MS,
    );
    return () => window.clearInterval(id);
  }, [rotating]);
  const router = useRouter();
  const pathname = usePathname();
  const setOrbState = useOrbStore((s) => s.setState);
  const offerUndo = useUndoStore((s) => s.offer);
  const clearUndo = useUndoStore((s) => s.clear);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const AGENT_ROUTES: Record<AgentId, string> = {
    jarvis: "/",
    tony: "/tony",
    lisa: "/lisa",
    vanessa: "/vanessa",
    marco: "/marco",
  };

  async function handleUtterance(utterance: string) {
    setOrbState("thinking");
    setAnswer(null);
    clearUndo();
    const outcome = await captureUtterance(utterance);

    // A question is answered in place rather than routed anywhere: the
    // landing screen's emptiness is the product's signature and must not
    // fill up with panels (build spec §5).
    if (outcome.answer) {
      setOrbState("idle");
      setFeedback(null);
      setAnswer(outcome.answer);
      return;
    }

    if (!outcome.ok || !outcome.agent) {
      setOrbState("idle");
      setFeedback(outcome.message);
      return;
    }

    // The delegating state is the payoff of the colour system: the user
    // watches the request hand off to the owning agent before its screen
    // even opens (build spec §5).
    setOrbState("delegating", outcome.agent);
    // Shown through the store rather than local state, so the offer
    // survives the handoff to the agent's screen.
    setFeedback(null);
    offerUndo(outcome.message, outcome.undo ?? []);

    // The value of notifications is obvious right after a first capture,
    // never at launch - and a denial has no recovery path (build spec §6).
    void ensureNotificationPermission();

    const destination = AGENT_ROUTES[outcome.agent];

    // Already in the room the capture belongs to - as when logging several
    // sessions in a row at the end of the day - so there is nothing to
    // hand off and no reason to make the user watch the handoff play out.
    if (pathname === destination) {
      setOrbState("idle");
      return;
    }

    window.setTimeout(() => {
      setOrbState("idle");
      router.push(destination);
    }, 1400);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    handleUtterance(text);
    setText("");
  }

  function handleMic() {
    const recognition = getSpeechRecognition();
    if (!recognition) {
      setFeedback("Voice input isn't supported in this browser.");
      return;
    }

    recognitionRef.current = recognition;
    // The recogniser takes one locale per session; a UK or Indian
    // English speaker fed a US model mis-hears "quid", "lakh",
    // "Asda", "Swiggy" and most place names.
    recognition.lang = getSpeechLocale();
    recognition.interimResults = false;
    setOrbState("listening");

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      handleUtterance(transcript);
    };
    recognition.onerror = () => setOrbState("idle");
    recognition.onend = () => {
      if (useOrbStore.getState().state === "listening") setOrbState("idle");
    };

    recognition.start();
  }

  const accentColor = variant === "jarvis" ? "var(--color-jarvis)" : undefined;

  return (
    <div className="flex flex-col gap-2 px-4">
      {feedback && <p className="text-xs text-foreground-muted">{feedback}</p>}

      <UndoBar />

      {answer && (
        <div className="rounded-xl border border-border bg-background-elevated p-3">
          <p className="text-sm">{answer.text}</p>
          {/* The visible reason for a cross-agent answer: which agents were
              consulted, and what was taken from each (build spec §10). */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {answer.sources.map((source) => (
              <span
                key={source.agent}
                className="rounded-full px-2 py-0.5 text-[10px]"
                style={{
                  backgroundColor: `color-mix(in oklch, var(--color-${source.agent}) 18%, transparent)`,
                  color: `var(--color-${source.agent})`,
                }}
              >
                {source.agent[0].toUpperCase() + source.agent.slice(1)}: {source.detail}
              </span>
            ))}
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            placeholder ??
            (rotating ? ROTATING_EXAMPLES[exampleIndex] : "Ask or log something...")
          }
          className="flex-1 rounded-full border border-border bg-background-elevated px-4 py-2 text-sm text-foreground outline-none"
        />
        <button
          type="button"
          onClick={handleMic}
          aria-label="Voice input"
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: accentColor ?? "var(--color-jarvis-muted)" }}
        >
          <MicIcon />
        </button>
        {variant === "agent" && (
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: "var(--color-jarvis)" }}
            title={`${homeName} is listening from here too`}
          />
        )}
      </form>
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth={2}>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}
