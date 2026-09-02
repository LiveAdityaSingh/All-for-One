import { describe, expect, it } from "vitest";
import {
  allocateNotifications,
  applicationUrgency,
  VANESSA_ROUTINE_URGENCY,
  type NotificationBid,
} from "./notification-budget";

function bid(partial: Partial<NotificationBid>): NotificationBid {
  return {
    agent: "tony",
    urgency: 10,
    title: "t",
    body: "b",
    reason: "r",
    ...partial,
  } as NotificationBid;
}

describe("notification budget", () => {
  it("never lets Marco interrupt, even alone and at maximum urgency", () => {
    const result = allocateNotifications([bid({ agent: "marco", urgency: 999 })]);
    expect(result.winners).toHaveLength(0);
    expect(result.suppressed.map((b) => b.agent)).toContain("marco");
  });

  it("gives the single slot to the highest-urgency bidder", () => {
    const result = allocateNotifications([
      bid({ agent: "vanessa", urgency: VANESSA_ROUTINE_URGENCY }),
      bid({ agent: "tony", urgency: 43 }),
    ]);
    expect(result.winners.map((b) => b.agent)).toEqual(["tony"]);
    expect(result.suppressed.map((b) => b.agent)).toEqual(["vanessa"]);
  });

  it("lets Vanessa through on a day Tony has nothing to say", () => {
    const result = allocateNotifications([
      bid({ agent: "vanessa", urgency: VANESSA_ROUTINE_URGENCY }),
    ]);
    expect(result.winners.map((b) => b.agent)).toEqual(["vanessa"]);
  });

  it("fires nothing when there are no bids", () => {
    expect(allocateNotifications([]).winners).toHaveLength(0);
  });

  it("ranks a final-stage nudge above a routine check-in", () => {
    // The spec's own worked example: Tony's day-3 final-stage nudge
    // outranks Vanessa's routine check-in.
    expect(applicationUrgency("final_stage", 3)).toBeGreaterThan(
      VANESSA_ROUTINE_URGENCY,
    );
  });

  it("scores later stages above earlier ones at equal lateness", () => {
    expect(applicationUrgency("final_stage", 0)).toBeGreaterThan(
      applicationUrgency("applied", 0),
    );
  });
});
