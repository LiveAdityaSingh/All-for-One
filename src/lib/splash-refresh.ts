// Works out the next launch's opening line and caches it.
//
// Deliberately run after the app is up rather than before: computing it
// needs the database open, which is the very delay the line is there to
// cover. So each launch pays for the next one.
import { db } from "./db";
import { criticalLoops } from "./open-loops";
import { currentStreak } from "./tasks";
import { buildSplashLine, writeSplashLine } from "./splash-line";

export async function refreshSplashLine(now: Date = new Date()): Promise<void> {
  try {
    const [tasks, applications, accounts, captures] = await Promise.all([
      db.tasks.toArray(),
      db.applications.toArray(),
      db.accounts.toArray(),
      db.captures.toArray(),
    ]);

    const best = tasks
      .map((task) => ({ task, days: currentStreak(task, now) }))
      .sort((a, b) => b.days - a.days)[0];

    const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const sessionsThisWeek = captures.filter(
      (c) => c.kind === "workout" && new Date(c.capturedAt).getTime() >= weekAgo,
    ).length;

    writeSplashLine(
      buildSplashLine(
        {
          streak: best && best.days > 0 ? { days: best.days, title: best.task.title } : null,
          openLoops: criticalLoops({ applications, tasks, accounts }, now).length,
          sessionsThisWeek,
        },
        Math.floor(now.getTime() / 86400000),
      ),
    );
  } catch {
    // Next launch simply shows whatever was cached before.
  }
}
