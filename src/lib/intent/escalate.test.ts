import { describe, expect, it } from "vitest";
import { intentFromModelOutput } from "./escalate";

// A model reply becomes real data in the user's database, so the mapping
// has to refuse anything underspecified rather than storing a guess.
function reply(partial: Record<string, unknown> = {}) {
  return {
    kind: "none",
    company: null,
    role: null,
    amount: null,
    merchant: null,
    account: null,
    activity: null,
    durationMinutes: null,
    title: null,
    accountName: null,
    ...partial,
  } as never;
}

describe("mapping a model reply to an intent", () => {
  it("maps a complete application", () => {
    expect(intentFromModelOutput(reply({
      kind: "application", company: "Acme", role: "Data Scientist",
    }))).toMatchObject({ type: "log_application", agent: "tony", company: "Acme" });
  });

  it("maps an expense and defaults an unnamed merchant", () => {
    expect(intentFromModelOutput(reply({ kind: "expense", amount: 10 })))
      .toMatchObject({ type: "log_expense", amount: 10, merchant: "Unspecified" });
  });

  it("keeps the account when the model heard one", () => {
    expect(intentFromModelOutput(reply({
      kind: "expense", amount: 12, merchant: "Lunch", account: "Monzo",
    }))).toMatchObject({ account: "Monzo" });
  });

  it("maps a workout with only a duration", () => {
    expect(intentFromModelOutput(reply({ kind: "workout", durationMinutes: 30 })))
      .toMatchObject({ type: "log_workout", activity: "Workout", durationMinutes: 30 });
  });

  it("maps a balance update", () => {
    expect(intentFromModelOutput(reply({
      kind: "balance", accountName: "Lloyds", amount: 722.58,
    }))).toMatchObject({ type: "set_balance", accountName: "Lloyds", amount: 722.58 });
  });
});

describe("refusing underspecified replies", () => {
  it("drops an expense with no amount rather than storing a guess", () => {
    expect(intentFromModelOutput(reply({ kind: "expense", merchant: "Lunch" }))).toBeNull();
  });

  it("drops an application missing the role", () => {
    expect(intentFromModelOutput(reply({ kind: "application", company: "Acme" }))).toBeNull();
  });

  it("drops a balance update with no account named", () => {
    expect(intentFromModelOutput(reply({ kind: "balance", amount: 500 }))).toBeNull();
  });

  it("drops a workout with neither activity nor duration", () => {
    expect(intentFromModelOutput(reply({ kind: "workout" }))).toBeNull();
  });

  it("drops an event with no title", () => {
    expect(intentFromModelOutput(reply({ kind: "event" }))).toBeNull();
  });

  it("passes through the model's own 'not a capture' verdict", () => {
    expect(intentFromModelOutput(reply({ kind: "none" }))).toBeNull();
  });

  it("handles a null reply", () => {
    expect(intentFromModelOutput(null)).toBeNull();
  });

  it("rejects a non-finite amount", () => {
    expect(intentFromModelOutput(reply({ kind: "expense", amount: Number.NaN }))).toBeNull();
  });
});

describe("normalising sloppy model output", () => {
  // The model sometimes fills unused fields with "" instead of null.
  it("treats an empty merchant as absent rather than a blank label", () => {
    expect(intentFromModelOutput(reply({
      kind: "expense", amount: 10, merchant: "   ",
    }))).toMatchObject({ merchant: "Unspecified" });
  });

  it("trims surrounding whitespace off values it keeps", () => {
    expect(intentFromModelOutput(reply({
      kind: "application", company: "  Hooli  ", role: " Data Scientist ",
    }))).toMatchObject({ company: "Hooli", role: "Data Scientist" });
  });

  it("treats an empty account as no account, not an empty one", () => {
    expect(intentFromModelOutput(reply({
      kind: "expense", amount: 5, merchant: "Pret", account: "",
    }))).toMatchObject({ account: null });
  });

  it("drops a balance whose account name is only whitespace", () => {
    expect(intentFromModelOutput(reply({
      kind: "balance", accountName: "  ", amount: 500,
    }))).toBeNull();
  });
});
