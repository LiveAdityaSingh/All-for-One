// Dictionaries for the on-device intent parser. Everything here is plain
// data so the parser stays deterministic and works with no network - the
// ~80% of utterances that are simple capture must never need a model
// call (build spec §3), and capture happens on the move, on the tube, in
// dead zones (build spec §12).

// Speech-to-text hands back number words far more often than digits
// ("forty quid", not "40 quid"), so the parser has to read both.
export const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19,
};

export const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

// Currency words a UK or Indian English speaker is likely to say out loud.
// Both sets are always accepted: which symbol is DISPLAYED comes from the
// user's currency setting, so hearing "quid" or "rupees" only affects
// recognition, never what the number means.
export const CURRENCY_WORDS = [
  "quid", "pounds", "pound", "gbp", "p", "pence",
  "rupees", "rupee", "inr", "rs", "paise",
];

// Indian English scales amounts in lakh and crore, which no amount of
// recogniser tuning would turn into digits on its own.
export const SCALE_WORDS: Record<string, number> = {
  lakh: 100000,
  lakhs: 100000,
  lac: 100000,
  lacs: 100000,
  crore: 10000000,
  crores: 10000000,
  k: 1000,
};

export const MINUTE_WORDS = ["minutes", "minute", "mins", "min", "m"];
export const HOUR_WORDS = ["hours", "hour", "hrs", "hr", "h"];

export const WEEKDAYS: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

// Lead verbs that route an utterance to an agent. Order matters only in
// that the parser tries the most specific pattern per domain first.
export const APPLICATION_VERBS = ["applied", "apply", "applying"];

export const EXPENSE_VERBS = [
  "spent", "spend", "paid", "bought", "logged", "log", "cost", "charged",
];

export const WORKOUT_VERBS = [
  "did", "ran", "run", "walked", "cycled", "swam", "lifted", "trained",
  "worked out", "workout", "played", "rowed",
];

export const SCHEDULE_VERBS = [
  "remind", "remember", "schedule", "book", "set", "add", "meeting", "call",
];

// Known workout activities, used to label a capture when the utterance
// names one. Unrecognised activities are still captured verbatim - the
// dictionary decides the label, never whether the capture is allowed.
// Logging happens after the fact, so the verb is almost always past
// tense ("ran 30 minutes"). When no activity is named separately, the
// verb itself is the activity - without this such a session is filed as
// a generic "Workout" and the weekly breakdown loses its meaning.
export const VERB_ACTIVITIES: Record<string, string> = {
  ran: "Running",
  run: "Running",
  walked: "Walking",
  cycled: "Cycling",
  swam: "Swimming",
  rowed: "Rowing",
  lifted: "Lifting",
  trained: "Training",
  boxed: "Boxing",
  climbed: "Climbing",
};

export const WORKOUT_ACTIVITIES = [
  "legs", "chest", "back", "arms", "shoulders", "core", "abs", "cardio",
  "running", "run", "cycling", "swimming", "rowing", "yoga", "pilates",
  "boxing", "climbing", "walking", "hiit", "push", "pull", "upper", "lower",
  "football", "tennis", "basketball", "gym",
];

// Common merchant/category words that help label an expense capture.
export const EXPENSE_CATEGORIES = [
  "groceries", "grocery", "food", "lunch", "dinner", "breakfast", "coffee",
  "rent", "bills", "transport", "travel", "petrol", "fuel", "train", "bus",
  "taxi", "uber", "clothes", "books", "gym", "subscription", "drinks",
  "takeaway", "shopping", "haircut", "phone", "internet",
];

// Banks a user is likely to name when logging an expense - UK and India,
// since either may be set as the speech locale.
export const KNOWN_ACCOUNTS = [
  // UK
  "monzo", "starling", "revolut", "barclays", "hsbc", "lloyds", "natwest",
  "santander", "halifax", "nationwide", "chase", "amex",
  // India
  "hdfc", "icici", "sbi", "axis", "kotak", "yes bank", "idfc", "indusind",
  "paytm", "phonepe", "gpay", "google pay", "bhim", "upi", "rupay",
];

// Income phrasing, so the Income/Net figures have something to read.
export const INCOME_VERBS = [
  "earned", "received", "got paid", "paid in", "income", "salary", "refund",
  "refunded", "reimbursed", "sold",
];

// Maps whatever the user said into the fixed category set the spending
// breakdown groups by. Anything unrecognised stays "Other" rather than
// inventing a category per merchant, which would make the chart useless.
export const CATEGORY_MAP: Record<string, string> = {
  groceries: "Groceries", grocery: "Groceries", food: "Groceries",
  asda: "Groceries", tesco: "Groceries", sainsbury: "Groceries",
  // India
  bigbasket: "Groceries", blinkit: "Groceries", zepto: "Groceries",
  dmart: "Groceries", "reliance fresh": "Groceries", instamart: "Groceries",
  swiggy: "Eating out", zomato: "Eating out", dominos: "Eating out",
  ola: "Transport", rapido: "Transport", irctc: "Transport",
  myntra: "Shopping", flipkart: "Shopping", ajio: "Shopping",
  jio: "Bills", airtel: "Bills", vodafone: "Bills",
  sainsburys: "Groceries", aldi: "Groceries", lidl: "Groceries",
  morrisons: "Groceries", waitrose: "Groceries", iceland: "Groceries",
  "co-op": "Groceries", coop: "Groceries", spar: "Groceries",
  shopping: "Shopping", clothes: "Shopping", books: "Shopping",
  lunch: "Eating out", dinner: "Eating out", breakfast: "Eating out",
  coffee: "Eating out", takeaway: "Eating out", drinks: "Eating out",
  transport: "Transport", travel: "Travel", petrol: "Transport",
  fuel: "Transport", train: "Transport", bus: "Transport", taxi: "Transport",
  uber: "Transport",
  rent: "Rent", bills: "Bills", phone: "Bills", internet: "Bills",
  gym: "Health", haircut: "Health",
  subscription: "Subscriptions",
};
