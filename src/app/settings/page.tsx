"use client";

import { useEffect, useRef, useState } from "react";
import {
  clearApiKey,
  getApiKey,
  PROVIDER_LABELS,
  setApiKey,
  type Provider,
} from "@/lib/llm";
import { useHasMounted } from "@/lib/use-has-mounted";
import {
  AGENT_IDS,
  CHARACTER_NAMES,
  DEFAULT_AGENT_NAMES,
  MAX_AGENT_NAME,
  nameClash,
  normaliseAgentName,
} from "@/lib/agent-names";
import { useAgentNamesStore } from "@/store/agent-names-store";
import type { AgentId } from "@/lib/types";
import {
  backupFilename,
  buildBackup,
  parseBackup,
  restoreBackup,
  summarise,
} from "@/lib/backup";
import {
  CURRENCIES,
  getCurrency,
  getSpeechLocale,
  setCurrency,
  setSpeechLocale,
  SPEECH_LOCALES,
  type CurrencyCode,
  type SpeechLocale,
} from "@/lib/locale";

interface ProviderInfo {
  provider: Provider;
  where: string;
  note: string;
}

// Groq is listed first because it is tried first: faster, and a much larger
// free daily quota. Either key alone is enough - the app falls back to the
// on-device parser whenever no model can answer.
const PROVIDERS: ProviderInfo[] = [
  {
    provider: "groq",
    where: "console.groq.com/keys",
    note: "Tried first. Free tier allows roughly 100–2,000 requests a day depending on model.",
  },
  {
    provider: "openrouter",
    where: "openrouter.ai/keys",
    note: "Used as a fallback. Free tier is 50 requests a day; $10 of credits raises it to 1,000.",
  },
];

function KeyField({ info }: { info: ProviderInfo }) {
  // localStorage only exists once mounted: this page's HTML is generated at
  // build time, so reading during render would mismatch on hydration.
  const hasMounted = useHasMounted();
  const [draft, setDraft] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const stored = hasMounted ? getApiKey(info.provider) : null;
  const value = draft ?? stored ?? "";

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setApiKey(info.provider, value.trim());
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  }

  function handleClear() {
    clearApiKey(info.provider);
    setDraft("");
  }

  return (
    <form
      onSubmit={handleSave}
      className="lip flex flex-col gap-2 rounded-2xl border border-border bg-background-elevated p-4"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{PROVIDER_LABELS[info.provider]}</span>
        {hasMounted && stored && (
          <span className="text-[11px]" style={{ color: "var(--color-jarvis)" }}>
            Key saved
          </span>
        )}
      </div>

      <input
        type="password"
        value={value}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Paste your key"
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />

      <p className="text-xs text-foreground-muted">
        {info.note} Get one at {info.where}.
      </p>

      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-full px-4 py-2 text-sm font-medium"
          style={{ backgroundColor: "var(--color-jarvis)", color: "var(--background)" }}
        >
          {saved ? "Saved" : "Save"}
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="rounded-full border border-border px-4 py-2 text-sm"
        >
          Clear
        </button>
      </div>
    </form>
  );
}

function YourData() {
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState<{ file: File; note: string } | null>(null);
  const [storage, setStorage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Reading it here rather than during render keeps the first client
    // render identical to the build-time HTML.
    void (async () => {
      if (!navigator.storage?.estimate) return;
      const { usage } = await navigator.storage.estimate();
      const persisted = await navigator.storage.persisted?.();
      const mb = ((usage ?? 0) / 1024 / 1024).toFixed(1);
      setStorage(
        `${mb} MB stored · ${persisted ? "protected from automatic cleanup" : "not protected from automatic cleanup"}`,
      );
    })();
  }, []);

  async function handleExport() {
    const backup = await buildBackup();
    const { total } = summarise(backup);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = backupFilename();
    link.click();
    URL.revokeObjectURL(url);
    setStatus(`Exported ${total} record${total === 1 ? "" : "s"}.`);
  }

  // Importing replaces everything, so it asks first and says exactly what
  // is in the file - a restore that silently wipes the wrong device would
  // be the worst possible outcome of a feature meant to protect data.
  async function handleChosen(file: File) {
    try {
      const backup = parseBackup(await file.text());
      const { total } = summarise(backup);
      const when = new Date(backup.exportedAt).toLocaleString();
      setPending({
        file,
        note: `${total} record${total === 1 ? "" : "s"}, exported ${when}`,
      });
      setStatus(null);
    } catch (error) {
      setPending(null);
      setStatus(error instanceof Error ? error.message : "Could not read that file.");
    }
  }

  async function confirmImport() {
    if (!pending) return;
    try {
      const backup = parseBackup(await pending.file.text());
      const { total } = await restoreBackup(backup);
      setPending(null);
      setStatus(`Restored ${total} record${total === 1 ? "" : "s"}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Import failed.");
    }
  }

  return (
    <div className="lip flex flex-col gap-3 rounded-2xl border border-border bg-background-elevated p-4">
      <span className="text-sm font-medium">Your data</span>

      <p className="text-xs text-foreground-muted">
        Everything lives on this device only, so this file is both your backup and
        the way to move to another device. Nothing is uploaded anywhere.
      </p>

      <div className="flex gap-2">
        <button
          onClick={handleExport}
          className="rounded-full px-4 py-2 text-sm font-medium"
          style={{ backgroundColor: "var(--color-jarvis)", color: "var(--background)" }}
        >
          Export
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="rounded-full border border-border px-4 py-2 text-sm"
        >
          Import
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleChosen(file);
            e.target.value = "";
          }}
        />
      </div>

      {pending && (
        <div
          className="flex flex-col gap-2 rounded-xl border p-3"
          style={{ borderColor: "var(--color-overdue)" }}
        >
          <p className="text-xs">
            This will <strong>replace everything</strong> on this device with the
            contents of that file ({pending.note}).
          </p>
          <div className="flex gap-2">
            <button
              onClick={confirmImport}
              className="rounded-full px-3 py-1.5 text-xs font-medium"
              style={{ backgroundColor: "var(--color-overdue)", color: "var(--background)" }}
            >
              Replace my data
            </button>
            <button
              onClick={() => setPending(null)}
              className="rounded-full border border-border px-3 py-1.5 text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {status && <p className="text-xs text-foreground-muted">{status}</p>}
      {storage && <p className="text-[11px] text-foreground-muted">{storage}</p>}
    </div>
  );
}

function VoiceAndMoney() {
  const hasMounted = useHasMounted();
  const [, force] = useState(0);

  const locale = hasMounted ? getSpeechLocale() : "en-GB";
  const currency = hasMounted ? getCurrency() : "GBP";

  return (
    <div className="lip flex flex-col gap-3 rounded-2xl border border-border bg-background-elevated p-4">
      <span className="text-sm font-medium">Voice and money</span>

      <label className="flex flex-col gap-1 text-xs text-foreground-muted">
        Speech recognition
        <select
          value={locale}
          onChange={(e) => {
            setSpeechLocale(e.target.value as SpeechLocale);
            force((n) => n + 1);
          }}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
        >
          {SPEECH_LOCALES.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-foreground-muted">
        Currency
        <select
          value={currency}
          onChange={(e) => {
            setCurrency(e.target.value as CurrencyCode);
            force((n) => n + 1);
          }}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
        >
          {CURRENCIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </label>

      <p className="text-xs text-foreground-muted">
        The recogniser understands one accent at a time, so picking the right one
        matters for words like &ldquo;quid&rdquo;, &ldquo;lakh&rdquo;, Asda or Swiggy.
        One currency is used throughout: runway and totals add amounts together, and
        mixing currencies without exchange rates would produce a number that looks
        precise but means nothing.
      </p>
    </div>
  );
}


// Renaming is cosmetic: the ids behind these names key the colours, the
// routes and every stored record, so a rename can never orphan data.
function AgentNames() {
  const names = useAgentNamesStore((s) => s.names);
  const rename = useAgentNamesStore((s) => s.rename);
  const applyAll = useAgentNamesStore((s) => s.applyAll);

  // Held separately from the saved name so a half-typed value is never
  // written, and an invalid one can be explained rather than swallowed.
  const [drafts, setDrafts] = useState<Partial<Record<AgentId, string>>>({});
  const [error, setError] = useState<string | null>(null);

  function commit(id: AgentId) {
    const draft = drafts[id];
    setDrafts((d) => ({ ...d, [id]: undefined }));
    if (draft === undefined) return;

    // An emptied field means "give me the default back".
    if (!draft.trim()) {
      setError(null);
      rename(id, null);
      return;
    }

    const clean = normaliseAgentName(draft);
    if (!clean) {
      setError(`Names are 1-${MAX_AGENT_NAME} characters, letters and numbers.`);
      return;
    }

    const clash = nameClash(names, id, clean);
    if (clash) {
      setError(`"${names[clash]}" is already taken.`);
      return;
    }

    setError(null);
    rename(id, clean);
  }

  const usingCharacters = AGENT_IDS.every((id) => names[id] === CHARACTER_NAMES[id]);
  const usingDefaults = AGENT_IDS.every((id) => names[id] === DEFAULT_AGENT_NAMES[id]);

  return (
    <div className="lip flex flex-col gap-3 rounded-2xl border border-border bg-background-elevated p-4">
      <span className="text-sm font-medium">What to call each agent</span>

      <div className="flex flex-col gap-2">
        {AGENT_IDS.map((id) => (
          <label key={id} className="flex items-center gap-3">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: `var(--color-${id})` }}
              aria-hidden
            />
            <input
              value={drafts[id] ?? names[id]}
              onChange={(e) => setDrafts((d) => ({ ...d, [id]: e.target.value }))}
              onBlur={() => commit(id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setDrafts((d) => ({ ...d, [id]: undefined }));
              }}
              maxLength={MAX_AGENT_NAME}
              aria-label={`Name for the ${DEFAULT_AGENT_NAMES[id]} agent`}
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <span className="w-16 shrink-0 text-right text-[11px] text-foreground-muted">
              {names[id] === DEFAULT_AGENT_NAMES[id] ? "default" : DEFAULT_AGENT_NAMES[id]}
            </span>
          </label>
        ))}
      </div>

      {error && (
        <p className="text-xs" style={{ color: "var(--color-overdue)" }}>{error}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setError(null); applyAll(CHARACTER_NAMES); }}
          disabled={usingCharacters}
          className="rounded-full border border-border px-3 py-1 text-xs disabled:opacity-40"
        >
          Use character names
        </button>
        <button
          onClick={() => { setError(null); applyAll({}); }}
          disabled={usingDefaults}
          className="rounded-full border border-border px-3 py-1 text-xs disabled:opacity-40"
        >
          Reset to defaults
        </button>
      </div>

      <p className="text-xs text-foreground-muted">
        You can also just say it: &ldquo;rename {names.tony} to Applications&rdquo; in the
        chat on any screen. Only the label changes &mdash; nothing you have already
        logged moves.
      </p>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-4 px-4">
      <h1 className="text-lg font-semibold">Settings</h1>

      <YourData />

      <VoiceAndMoney />

      <AgentNames />

      <p className="text-sm text-foreground-muted">
        Keys are optional. Without one the app still captures everything it recognises
        on its own, offline; a key only lets it understand phrasing the built-in parser
        misses.
      </p>

      {PROVIDERS.map((info) => (
        <KeyField key={info.provider} info={info} />
      ))}

      <p className="text-xs text-foreground-muted">
        Keys are stored only on this device and sent only to the provider they belong
        to. They are never bundled into the app or shared with anyone else.
      </p>
    </div>
  );
}
