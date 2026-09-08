"use client";

import { useState } from "react";

// Editing a record in the place you read it.
//
// Voice is the primary way in and voice mishears, so a wrong record is not
// an edge case - it is Tuesday. Until now the only remedy was to delete
// and re-say it, which loses the timestamp and everything else that was
// right. This makes the text itself the control.
export function InlineEdit({
  value,
  onSave,
  label,
  className = "",
  placeholder,
}: {
  value: string;
  // Returns whatever the caller's write returns - Dexie's update
  // resolves to a row count, not void.
  onSave: (next: string) => void | Promise<unknown>;
  // Announced to screen readers, which get nothing from "the text is now
  // a box".
  label: string;
  className?: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function begin() {
    setDraft(value);
    setEditing(true);
  }

  async function commit() {
    setEditing(false);
    const next = draft.trim();
    // An empty box means "I changed my mind", never "delete the label" -
    // deleting is a separate, deliberate action.
    if (!next || next === value) return;
    await onSave(next);
  }

  if (!editing) {
    return (
      <button
        onClick={begin}
        aria-label={`Edit ${label}`}
        className={`truncate text-left ${className}`}
      >
        {value || <span className="text-foreground-muted">{placeholder ?? "Untitled"}</span>}
      </button>
    );
  }

  return (
    <input
      autoFocus
      value={draft}
      aria-label={label}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        // Escape abandons the edit, so a mis-tap costs nothing.
        if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
      }}
      className={`w-full rounded-md border border-border bg-background px-2 py-1 outline-none ${className}`}
    />
  );
}
