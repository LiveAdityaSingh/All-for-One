import { describe, expect, it } from "vitest";
import { speechErrorMessage } from "./speech-errors";

describe("what a failed microphone says", () => {
  // Stopping it yourself is not a fault, so it stays quiet.
  it("says nothing when the user aborted it", () => {
    expect(speechErrorMessage("aborted")).toBeNull();
  });

  it("names the fix for a denied microphone", () => {
    const message = speechErrorMessage("not-allowed");
    expect(message).toMatch(/settings/i);
    expect(speechErrorMessage("service-not-allowed")).toBe(message);
  });

  it("distinguishes a silent room from a missing microphone", () => {
    expect(speechErrorMessage("no-speech")).toMatch(/didn't catch/i);
    expect(speechErrorMessage("audio-capture")).toMatch(/No microphone/i);
    expect(speechErrorMessage("no-speech")).not.toBe(speechErrorMessage("audio-capture"));
  });

  // The rest of the app works offline, so a network failure should not
  // imply the whole thing is down.
  it("makes clear only speech needs the network", () => {
    expect(speechErrorMessage("network")).toMatch(/offline/i);
  });

  it("still says something useful for an unknown reason", () => {
    expect(speechErrorMessage("something-new")).toMatch(/Type it instead/i);
    expect(speechErrorMessage(undefined)).toMatch(/Type it instead/i);
  });
});

// Verified on device: Android's WebView reports "not-allowed" even with
// RECORD_AUDIO granted, because it has no speech engine behind the API.
describe("the installed app is honest about not having an engine", () => {
  it("does not send you to settings for a permission you already gave", () => {
    const message = speechErrorMessage("not-allowed", true);
    expect(message).not.toMatch(/settings/i);
    expect(message).toMatch(/native speech engine/i);
  });

  it("still points at settings in a browser, where it really is permission", () => {
    expect(speechErrorMessage("not-allowed", false)).toMatch(/settings/i);
  });
});
