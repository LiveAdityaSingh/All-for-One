// What to say when the microphone does not work.
//
// The recogniser reports a precise reason and the app was throwing it
// away: onerror only reset the orb, so every failure looked identical -
// tap the mic, nothing happens, no explanation. A denied permission and a
// silent room are very different problems and the fix for each is
// different, so each one says so.

export type SpeechFailure =
  | "no-speech"
  | "aborted"
  | "audio-capture"
  | "network"
  | "not-allowed"
  | "service-not-allowed"
  | "language-not-supported"
  | (string & {});

// Returning null means "say nothing": the user stopped it themselves, and
// an error message for an action they took reads as a fault.
//
// `installed` matters for exactly one case. Android's WebView exposes the
// Web Speech constructor but has no engine behind it, so it reports
// "not-allowed" even once RECORD_AUDIO has been granted - verified on
// device. Telling someone to check a permission they have already given is
// worse than admitting the feature is not there yet.
export function speechErrorMessage(
  error: SpeechFailure | undefined,
  installed = false,
): string | null {
  switch (error) {
    case "aborted":
      return null;

    case "not-allowed":
    case "service-not-allowed":
      return installed
        ? "Voice isn't available in the installed app yet - it needs a native speech engine. Type it instead, or use the web version for now."
        : "Microphone access is off. Turn it on for this app in your device settings, then tap the mic again.";

    case "no-speech":
      return "I didn't catch anything. Tap the mic and speak, or just type it.";

    case "audio-capture":
      return "No microphone available. You can still type.";

    case "network":
      return "Speech recognition needs a connection. Type it instead - everything else works offline.";

    case "language-not-supported":
      return "That accent isn't available for speech here. Try another under Settings, or type it.";

    default:
      return "Voice input didn't work that time. Type it instead.";
  }
}
