"use client";

// The last resort: a failure in the root layout itself, where no styling,
// no tab bar and no theme survive. It has to render its own document, so
// the few colours here are deliberately inlined rather than tokenised.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: "oklch(0.155 0.010 268)",
          color: "oklch(0.93 0.008 268)",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        }}
      >
        <div style={{ maxWidth: 360, display: "flex", flexDirection: "column", gap: 12 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
            All for One couldn&apos;t start
          </h1>
          <p style={{ fontSize: 14, margin: 0, color: "oklch(0.68 0.008 268)" }}>
            Your data is still on this device — this is a problem with the app, not
            with what you have stored.
          </p>
          <button
            onClick={reset}
            style={{
              alignSelf: "flex-start",
              border: "none",
              borderRadius: 9999,
              padding: "10px 18px",
              fontSize: 14,
              fontWeight: 500,
              background: "oklch(0.62 0.13 155)",
              color: "oklch(0.155 0.010 268)",
            }}
          >
            Reload
          </button>
          {error.digest && (
            <p style={{ fontSize: 11, margin: 0, color: "oklch(0.68 0.008 268)" }}>
              Reference: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
