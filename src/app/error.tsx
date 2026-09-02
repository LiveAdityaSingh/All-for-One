"use client";

import { useEffect } from "react";

// A crash in one screen should cost that screen, not the session. This
// replaces the failed route while the layout - and so the tab bar - stays
// put, which turns a dead end into "try again, or go somewhere else".
export default function ScreenError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Kept for the person debugging it later; nothing is sent anywhere.
    console.error("Screen failed:", error);
  }, [error]);

  return (
    <div className="flex flex-col gap-3 px-4">
      <h1 className="text-lg font-semibold">This screen didn&apos;t load</h1>

      <p className="text-sm text-foreground-muted">
        Your data is untouched and stored on this device. The other tabs below still
        work, so nothing is lost while this one is misbehaving.
      </p>

      <div className="flex gap-2">
        <button
          onClick={reset}
          className="rounded-full px-4 py-2 text-sm font-medium"
          style={{ backgroundColor: "var(--color-jarvis)", color: "var(--background)" }}
        >
          Try again
        </button>
        <a
          href="/settings"
          className="rounded-full border border-border px-4 py-2 text-sm"
        >
          Back up my data
        </a>
      </div>

      {error.digest && (
        <p className="text-[11px] text-foreground-muted">Reference: {error.digest}</p>
      )}
    </div>
  );
}
