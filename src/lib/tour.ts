// The first-run walkthrough.
//
// Ordered the way someone actually meets the app: the way in first, then
// where things go, then each agent in tab order. Every step names one
// thing and says what it is for - a tour that explains everything explains
// nothing, and the reader is standing in front of their own app waiting to
// use it.

export interface TourStep {
  id: string;
  // Where this step lives. The walkthrough navigates there before showing
  // it, so a step can point at anything on any screen.
  route?: string;
  // The data-tour value to cut out of the overlay. Absent means the whole
  // screen stays covered, which is how the tour opens and closes.
  target?: string;
  title: string;
  body: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    route: "/",
    title: "Here's a walkthrough of the app",
    body: "Five agents, one place. It takes about a minute, and you can leave at any point.",
  },
  {
    id: "capture",
    route: "/",
    target: "chat",
    title: "Say it or type it",
    body: "This is the way in, and it is on every screen. \u201cSpent 12 quid on lunch\u201d, \u201cslept 7 hours\u201d, \u201capplied to Acme for Data Scientist\u201d \u2014 it works out who it belongs to and files it there.",
  },
  {
    id: "tabs",
    route: "/",
    target: "tabs",
    title: "The five agents",
    body: "Each owns one part of your life and one colour. You can rename any of them later if these are not the words you use.",
  },
  {
    id: "home",
    route: "/",
    target: "loops",
    title: "What is waiting on you",
    body: "Home gathers anything overdue from every agent. On a day with nothing owed it shows nothing at all \u2014 that emptiness is the good news.",
  },
  {
    id: "job",
    route: "/tony",
    target: "score",
    title: "Job: is the pipeline alive?",
    body: "The share of applications still moving rather than going quiet. Volume is not progress, so a rejection does not count against you.",
  },
  {
    id: "job-menu",
    route: "/tony",
    target: "menu",
    title: "Everything else lives here",
    body: "Log an application, import a spreadsheet, and the claims your CV is allowed to draw on. Every agent keeps its extras behind this button.",
  },
  {
    id: "daily",
    route: "/lisa",
    target: "score",
    title: "Daily: what you said you would do",
    body: "Reminders with a time, habits with a rhythm, and milestones with an end. Dated ones alert you even with the app closed.",
  },
  {
    id: "streaks",
    route: "/lisa",
    target: "streaks",
    title: "Habits build a run",
    body: "Keep a habit up and a run appears here, counting the days and warming as it climbs. At three weeks it stops being a habit you are building and becomes an ordinary daily task.",
  },
  {
    id: "finances",
    route: "/vanessa",
    target: "totals",
    title: "Finances: in, out, and what is left",
    body: "Say what you spent and it lands here. Name the account and its balance moves too.",
  },
  {
    id: "runway",
    route: "/vanessa",
    target: "pulse",
    title: "How long the money lasts",
    body: "Worked out from your balances over time, not from logged spending \u2014 logging is optional, so anything built on it would quietly mislead. It glows while the figures can be trusted and goes grey when they cannot.",
  },
  {
    id: "health",
    route: "/marco",
    target: "score",
    title: "Health: movement, sleep and fuel",
    body: "One number from the three, against ordinary weekly guidelines. It measures how consistently you logged them, and it is not a medical assessment.",
  },
  {
    id: "settings",
    route: "/",
    target: "settings",
    title: "Everything is yours",
    body: "Rename the agents, pick your accent and currency, and export the lot. Nothing here leaves your device.",
  },
  {
    id: "done",
    route: "/",
    title: "That's it",
    body: "Start by saying something. Anything you log is yours alone, on this device, and you can throw it away just as easily.",
  },
];
