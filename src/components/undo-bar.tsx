"use client";

import { useEffect } from "react";
import { undoCapture } from "@/lib/capture";
import { useUndoStore } from "@/store/undo-store";

// Long enough to read the confirmation and react, short enough that it is
// gone before it becomes clutter.
const LINGER_MS = 9000;

export function UndoBar() {
  const { message, steps, clear } = useUndoStore();

  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(clear, LINGER_MS);
    return () => window.clearTimeout(id);
  }, [message, clear]);

  if (!message) return null;

  async function handleUndo() {
    if (steps?.length) await undoCapture(steps);
    clear();
  }

  return (
    <div className="flex items-center gap-3 px-4">
      <p className="min-w-0 flex-1 text-xs text-foreground-muted">{message}</p>
      {steps && steps.length > 0 && (
        <button
          onClick={handleUndo}
          className="shrink-0 rounded-full border border-border px-3 py-1 text-xs"
        >
          Undo
        </button>
      )}
    </div>
  );
}
