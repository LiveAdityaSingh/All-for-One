"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { scheduleDailyDigest } from "@/lib/notifications";
import { installReminderSync, syncReminders } from "@/lib/reminders";
import { snapshotIfDue } from "@/lib/snapshot";
import { seedDailyReview } from "@/lib/seed";
import { useOpeningStore } from "@/store/opening-store";
import { refreshSplashLine } from "@/lib/splash-refresh";
import { useAgentNamesStore } from "@/store/agent-names-store";
import { useCurrencyStore } from "@/store/currency-store";

// One place for the work that has to happen once per launch, before the
// user does anything.
export function AppBootstrap() {
  const syncCurrency = useCurrencyStore((s) => s.sync);
  const syncAgentNames = useAgentNamesStore((s) => s.sync);
  const markReady = useOpeningStore((s) => s.markReady);

  useEffect(() => {
    // Reading localStorage here rather than during render keeps the first
    // client render identical to the build-time HTML.
    syncCurrency();
    syncAgentNames();

    // The one thing the app suggests by default: an evening habit to bring
    // the day up to date. Runs on every launch and does nothing on all but
    // the first, and never returns once it has been deleted.
    void seedDailyReview();

    // The opening overlay comes down once setup has run. Nothing is held
    // back beyond this: the line is meant to fill real waiting, never to
    // manufacture a pause.
    markReady();

    // Computed after the app is up and cached for next time, because
    // working it out needs the database open - which is the slow part the
    // line exists to cover.
    void refreshSplashLine();

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

      // Reminders are reconciled against the database on every launch, so
      // a reboot, a restore, or permission finally being granted all
      // repair themselves without the user doing anything. The hooks then
      // keep the OS in step with every later write.
      installReminderSync();
      void syncReminders();

      // storage.persist() is refused on this device, so the WebView's
      // IndexedDB is evictable. App-private files are not, so a daily
      // snapshot lands somewhere the system will not clear.
      void snapshotIfDue();
    }
  }, [syncCurrency, syncAgentNames, markReady]);

  return null;
}
