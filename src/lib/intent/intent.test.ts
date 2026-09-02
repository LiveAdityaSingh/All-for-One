import { describe, expect, it } from "vitest";
import { classifyUtterance } from "./index";
import { extractDurationMinutes, extractMoney, extractWhen } from "./extract";

// The parser runs offline on every captured utterance, so a regression
// here silently mis-files a user's data rather than failing loudly.

describe("Tony - job applications", () => {
  it("parses company and role", () => {
    const result = classifyUtterance("applied to Globex for Backend Engineer");
    expect(result).toMatchObject({
      type: "log_application",
      agent: "tony",
      company: "Globex",
      role: "Backend Engineer",
    });
  });

  it("handles 'at' and a leading article on the role", () => {
    expect(classifyUtterance("applied at Acme Corp for a Data Scientist")).toMatchObject({
      type: "log_application",
      company: "Acme Corp",
      role: "Data Scientist",
    });
  });
});

describe("Vanessa - expenses", () => {
  it("parses the spec's own example", () => {
    expect(classifyUtterance("logged 40 quid on groceries")).toMatchObject({
      type: "log_expense",
      agent: "vanessa",
      amount: 40,
      merchant: "Groceries",
    });
  });

  it("parses number words, merchant and account together", () => {
    expect(classifyUtterance("spent twelve quid on lunch, Monzo")).toMatchObject({
      type: "log_expense",
      amount: 12,
      merchant: "Lunch",
      account: "Monzo",
    });
  });

  it("parses a currency symbol with decimals", () => {
    expect(classifyUtterance("spent £8.50 on coffee")).toMatchObject({
      amount: 8.5,
      merchant: "Coffee",
    });
  });

  it("parses a bare amount after a spend verb", () => {
    expect(classifyUtterance("spent 40 on groceries")).toMatchObject({
      amount: 40,
      merchant: "Groceries",
    });
  });
});

describe("Marco - workouts", () => {
  it("parses the spec's own example", () => {
    expect(classifyUtterance("did 45 minutes legs")).toMatchObject({
      type: "log_workout",
      agent: "marco",
      activity: "Legs",
      durationMinutes: 45,
    });
  });

  it("sums hours and minutes", () => {
    expect(classifyUtterance("did 1 hour 30 of cardio")).toMatchObject({
      activity: "Cardio",
      durationMinutes: 90,
    });
  });

  it("parses worded durations", () => {
    expect(classifyUtterance("did ninety minutes yoga")).toMatchObject({
      activity: "Yoga",
      durationMinutes: 90,
    });
  });
});

describe("Lisa - scheduling", () => {
  it("strips the time phrase out of the title", () => {
    expect(classifyUtterance("remind me to call the plumber at 5pm")).toMatchObject({
      type: "schedule_event",
      agent: "lisa",
      title: "call the plumber",
    });
  });
});

describe("fallthrough", () => {
  it("does not guess at an utterance it has no rule for", () => {
    expect(classifyUtterance("the weather looks nice")).toMatchObject({ type: "unhandled" });
  });

  it("handles empty input", () => {
    expect(classifyUtterance("   ")).toMatchObject({ type: "unhandled" });
  });
});

describe("extractors", () => {
  it("reads durations in several shapes", () => {
    expect(extractDurationMinutes("90 mins")).toBe(90);
    expect(extractDurationMinutes("an hour")).toBe(60);
    expect(extractDurationMinutes("2 hours 15 minutes")).toBe(135);
    expect(extractDurationMinutes("nothing numeric")).toBeNull();
  });

  it("returns null rather than guessing an amount", () => {
    expect(extractMoney("spent some money on lunch")).toBeNull();
  });

  it("rolls a past bare time forward to tomorrow", () => {
    const now = new Date("2026-03-10T18:00:00");
    const when = extractWhen("at 9am", now);
    expect(when?.getDate()).toBe(11);
    expect(when?.getHours()).toBe(9);
  });

  it("resolves a weekday to the next occurrence", () => {
    const now = new Date("2026-03-10T10:00:00"); // a Tuesday
    const when = extractWhen("friday at 2pm", now);
    expect(when?.getDay()).toBe(5);
    expect(when?.getHours()).toBe(14);
  });
});

describe("Vanessa - balance updates", () => {
  it("parses a bare 'X is N' statement", () => {
    expect(classifyUtterance("monzo is 1200")).toMatchObject({
      type: "set_balance",
      agent: "vanessa",
      accountName: "monzo",
      amount: 1200,
    });
  });

  it("parses an explicit set with a currency symbol and commas", () => {
    expect(classifyUtterance("set savings to £12,500")).toMatchObject({
      type: "set_balance",
      accountName: "savings",
      amount: 12500,
    });
  });
});

describe("Jarvis - questions", () => {
  it("routes a runway question to Jarvis, not to a capture", () => {
    expect(classifyUtterance("what's my runway?")).toMatchObject({
      type: "question",
      agent: "jarvis",
      topic: "runway",
    });
  });

  it("recognises a pipeline question", () => {
    expect(classifyUtterance("how are my applications going?")).toMatchObject({
      topic: "pipeline",
    });
  });

  it("recognises a health question", () => {
    expect(classifyUtterance("how much did I train this week?")).toMatchObject({
      topic: "health",
    });
  });

  it("still logs a spend that merely mentions money", () => {
    // Must not be swallowed by the runway question pattern.
    expect(classifyUtterance("spent 40 quid on groceries")).toMatchObject({
      type: "log_expense",
    });
  });

  it("does not treat a bare capture as a question", () => {
    expect(classifyUtterance("did 45 minutes legs")).toMatchObject({
      type: "log_workout",
    });
  });
});

describe("Marco - past-tense logging", () => {
  // End-of-day logging is retrospective, so the verb carries the activity.
  it("reads 'ran' as running rather than a generic workout", () => {
    expect(classifyUtterance("ran 30 minutes")).toMatchObject({
      type: "log_workout",
      activity: "Running",
      durationMinutes: 30,
    });
  });

  it("reads other past-tense verbs as their activity", () => {
    expect(classifyUtterance("swam 40 minutes")).toMatchObject({ activity: "Swimming" });
    expect(classifyUtterance("cycled an hour")).toMatchObject({
      activity: "Cycling",
      durationMinutes: 60,
    });
  });

  it("still prefers an explicitly named activity over the verb", () => {
    expect(classifyUtterance("did 45 minutes legs")).toMatchObject({ activity: "Legs" });
  });
});

describe("duration units glued to words", () => {
  // The single-letter units ("m", "h") must not match inside a word.
  it("does not read the m in 'swam' as minutes", () => {
    expect(extractDurationMinutes("swam 40 minutes")).toBe(40);
  });

  it("still accepts a unit attached to a digit", () => {
    expect(extractDurationMinutes("40m")).toBe(40);
  });

  it("is unaffected by other words ending in a unit letter", () => {
    expect(extractDurationMinutes("gym 25 minutes")).toBe(25);
  });
});

describe("Vanessa - income", () => {
  it("parses a bare amount after an income verb", () => {
    expect(classifyUtterance("earned 2000 salary")).toMatchObject({
      type: "log_income",
      agent: "vanessa",
      amount: 2000,
    });
  });

  it("handles a multi-word income verb", () => {
    expect(classifyUtterance("got paid 1800")).toMatchObject({
      type: "log_income",
      amount: 1800,
    });
  });

  it("does not mistake spending for income", () => {
    expect(classifyUtterance("spent 40 quid on groceries")).toMatchObject({
      type: "log_expense",
    });
  });
});

describe("not mistaking ordinary English for a capture", () => {
  // "back" is a workout activity, but "heard back from X" is news about an
  // existing application - logging it as a Back workout is silent data
  // corruption the user has to find and delete.
  it("does not read 'heard back from' as a workout", () => {
    expect(classifyUtterance("heard back from Globex, they want a second interview"))
      .toMatchObject({ type: "unhandled" });
  });

  it("does not read an aching back as a workout", () => {
    expect(classifyUtterance("my back hurts")).toMatchObject({ type: "unhandled" });
  });

  it("still accepts a workout with a verb", () => {
    expect(classifyUtterance("did 45 minutes legs")).toMatchObject({ type: "log_workout" });
  });

  it("still accepts a workout with only a duration", () => {
    expect(classifyUtterance("45 minutes legs")).toMatchObject({ type: "log_workout" });
  });
});

describe("Indian English amounts", () => {
  it("reads the rupee symbol", () => {
    expect(classifyUtterance("spent ₹500 on groceries")).toMatchObject({
      type: "log_expense",
      amount: 500,
    });
  });

  it("reads 'rupees' as a currency word", () => {
    expect(classifyUtterance("spent 250 rupees on lunch")).toMatchObject({ amount: 250 });
  });

  it("reads the Rs prefix, where the unit comes before the number", () => {
    expect(classifyUtterance("paid Rs 1200 for the train")).toMatchObject({ amount: 1200 });
  });

  it("scales lakh", () => {
    // A missing multiplier here is a 100,000x error, not a rounding slip.
    expect(classifyUtterance("spent 2 lakh on the wedding")).toMatchObject({
      amount: 200000,
    });
  });

  it("scales crore, including a decimal", () => {
    expect(classifyUtterance("paid 1.5 crore for the flat")).toMatchObject({
      amount: 15000000,
    });
  });

  it("scales a lakh written with the rupee symbol", () => {
    expect(classifyUtterance("spent ₹3 lakh on the car")).toMatchObject({ amount: 300000 });
  });

  it("recognises an Indian bank as the account", () => {
    expect(classifyUtterance("spent 400 rupees on lunch, HDFC")).toMatchObject({
      account: "Hdfc",
    });
  });

  it("still reads pounds when the currency word is British", () => {
    expect(classifyUtterance("spent 40 quid on groceries")).toMatchObject({ amount: 40 });
  });
});

describe("remembering which currency was spoken", () => {
  // Amounts are stored as bare numbers, but what the user SAID is kept so a
  // contradiction with their setting can be shown instead of ignored.
  it("notes pounds when a British word is used", () => {
    expect(classifyUtterance("spent 12 quid on lunch")).toMatchObject({
      amount: 12,
      spokenCurrency: "GBP",
    });
  });

  it("notes rupees for the word and the symbol alike", () => {
    expect(classifyUtterance("spent 250 rupees on lunch")).toMatchObject({
      spokenCurrency: "INR",
    });
    expect(classifyUtterance("spent ₹500 on groceries")).toMatchObject({
      spokenCurrency: "INR",
    });
    expect(classifyUtterance("paid Rs 1200 for the train")).toMatchObject({
      spokenCurrency: "INR",
    });
  });

  it("notes pounds for the pound symbol", () => {
    expect(classifyUtterance("spent £8.50 on coffee")).toMatchObject({
      spokenCurrency: "GBP",
    });
  });

  it("records nothing when no currency was named", () => {
    expect(classifyUtterance("spent 40 on groceries")).toMatchObject({
      amount: 40,
      spokenCurrency: null,
    });
  });

  it("records nothing for a bare scale word", () => {
    expect(classifyUtterance("spent 2 lakh on the wedding")).toMatchObject({
      amount: 200000,
      spokenCurrency: null,
    });
  });
});
