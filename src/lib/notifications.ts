// OS notification wiring. Everything the user is ever interrupted by
// goes through here, so the budget in notification-budget.ts is the only
// gate that matters.
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { db } from "./db";
import { buildDailyDigest } from "./nudge-engine";
import { isStale } from "./finance";
import {
  allocateNotifications,
  applicationUrgency,
  VANESSA_ROUTINE_URGENCY,
  type NotificationBid,
} from "./notification-budget";

// Vanessa nudges at night (build spec §8). Cadence settled with the user:
// checked nightly at 8pm, but she only bids when a balance has actually
// gone stale, so a quiet week stays silent.
const DIGEST_HOUR = 20;
const DIGEST_ID = 1;

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

// Requested immediately after the user's first capture, when the value
// is obvious - never at launch. On Android 13+ POST_NOTIFICATIONS is a
// runtime permission with no recovery path if denied (build spec §6).
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!isNative()) return false;

  try {
    const current = await LocalNotifications.checkPermissions();
    if (current.display === "granted") return true;
    if (current.display === "denied") return false;

    const asked = await LocalNotifications.requestPermissions();
    return asked.display === "granted";
  } catch {
    return false;
  }
}

// Collect what each agent would like to say tonight. Marco never bids -
// the budget allocator drops him regardless, but he isn't asked either.
async function collectBids(): Promise<NotificationBid[]> {
  const bids: NotificationBid[] = [];

  const digest = await buildDailyDigest();
  if (digest.length > 0) {
    const top = digest[0];
    // Copy tone matters here: Tony asks a question, he doesn't audit
    // failure (build spec §6).
    const body =
      digest.length === 1
        ? `Any news on ${top.application.company}?`
        : `Any news on these ${digest.length}?`;

    bids.push({
      agent: "tony",
      urgency: applicationUrgency(top.application.stage, top.daysOverdue),
      title: "Tony",
      body,
      reason: `${digest.length} application${digest.length === 1 ? "" : "s"} waiting on a reply`,
    });
  }

  // Vanessa nudges at night, and only when something has actually gone
  // stale (decided with the user). Staying silent while the numbers are
  // fresh is what keeps the prompt worth reading when it does appear.
  const accounts = await db.accounts.toArray();
  const stale = accounts.filter((account) => isStale(account));

  if (stale.length > 0) {
    bids.push({
      agent: "vanessa",
      urgency: VANESSA_ROUTINE_URGENCY,
      title: "Vanessa",
      body:
        stale.length === 1
          ? `What's ${stale[0].name} at?`
          : `Quick balance check on ${stale.length} accounts?`,
      reason: `${stale.length} balance${stale.length === 1 ? "" : "s"} older than a week`,
    });
  }

  return bids;
}

// One batched digest per day. Never one notification per job
// (build spec §6): thirty open applications must produce one card.
export async function scheduleDailyDigest(): Promise<void> {
  if (!isNative()) return;
  if (!(await ensureNotificationPermission())) return;

  const { winners } = allocateNotifications(await collectBids());

  try {
    await LocalNotifications.cancel({ notifications: [{ id: DIGEST_ID }] });
    if (winners.length === 0) return;

    const at = new Date();
    at.setHours(DIGEST_HOUR, 0, 0, 0);
    if (at.getTime() <= Date.now()) at.setDate(at.getDate() + 1);

    const [primary] = winners;

    await LocalNotifications.schedule({
      notifications: [
        {
          id: DIGEST_ID,
          title: primary.title,
          body: primary.body,
          schedule: {
            at,
            // OEM battery killers on Samsung/Xiaomi/OnePlus/Oppo drop
            // inexact background work regardless of what the docs
            // promise (build spec §12), so this has to be an exact alarm.
            allowWhileIdle: true,
          },
          extra: { reason: primary.reason },
        },
      ],
    });
  } catch {
    // A failure to schedule must never break the capture that triggered
    // it - the user's data is already saved by this point.
  }
}
