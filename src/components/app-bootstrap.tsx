"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { scheduleDailyDigest } from "@/lib/notifications";
import { useCurrencyStore } from "@/store/currency-store";

// One place for the work that has to happen once per launch, before the
// user does anything.
export function AppBootstrap() {
  const syncCurrency = useCurrencyStore((s) => s.sync);

  useEffect(() => {
    // Reading localStorage here rather than during render keeps the first
    // client render identical to the build-time HTML.
    syncCurrency();

    // This app has no server, so the browser holds the only copy. Persistent
    // storage is exempt from the automatic eviction that otherwise clears
    // origins when the device runs low on space. Chrome grants it silently
    // for installed apps; it can refuse, which is why the export in Settings
    // is the real safety net rather than this.
    void navigator.storage?.persist?.().catch(() => {});

    // Offline app shell (build spec §12). Skipped inside the Capacitor
    // WebView, where every asset is already local and a service worker
    // would only add a second, staler cache in front of them.
    if (!Capacitor.isNativePlatform() && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // An unavailable service worker costs offline support, not the app.
      });
    }

    // Re-evaluates the evening digest: the bids depend on how stale each
    // application has become, so the winning agent can change from one day
    // to the next with no user action at all.
    if (Capacitor.isNativePlatform()) {
      void scheduleDailyDigest();
    }
  }, [syncCurrency]);

  return null;
}
