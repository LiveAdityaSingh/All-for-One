// One way to listen, whichever engine is actually available.
//
// The web build uses the Web Speech API. The installed app cannot: Android's
// WebView exposes the constructor but has no engine behind it, so start()
// returns "not-allowed" even with RECORD_AUDIO granted - verified on device.
// There it drives Android's own SpeechRecognizer through a plugin instead.
//
// Both paths report partial text as you speak, which is the point. Waiting
// for a whole phrase before showing anything makes the app look deaf, and
// leaves you with no idea whether it heard "Asda" or "Astor" until it is
// already logged.
import { Capacitor } from "@capacitor/core";

export interface SpeechHandlers {
  // Fired repeatedly while speaking, with the best guess so far.
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  // Values match the Web Speech API's error names, so one message table
  // serves both engines.
  onError: (error: string) => void;
  onEnd: () => void;
}

export interface SpeechSession {
  stop: () => void;
}

interface WebRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: WebResultEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

interface WebResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

function webRecogniser(): WebRecognition | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => WebRecognition;
    webkitSpeechRecognition?: new () => WebRecognition;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

function startWeb(lang: string, handlers: SpeechHandlers): SpeechSession | null {
  const recognition = webRecogniser();
  if (!recognition) return null;

  recognition.lang = lang;
  recognition.interimResults = true;
  recognition.continuous = false;

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const text = result[0].transcript;
      if (result.isFinal) handlers.onFinal(text);
      else handlers.onPartial(text);
    }
  };
  recognition.onerror = (event) => handlers.onError(event?.error ?? "unknown");
  recognition.onend = () => handlers.onEnd();

  recognition.start();
  return { stop: () => recognition.stop() };
}

// How long a single utterance may run before it is closed regardless.
// Android's recogniser normally stops itself on silence; this only exists
// so a recogniser that never reports finishing cannot leave the microphone
// button stuck on "Stop" forever.
const MAX_UTTERANCE_MS = 20000;
const POLL_MS = 400;

async function startNative(lang: string, handlers: SpeechHandlers): Promise<SpeechSession | null> {
  const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");

  const { available } = await SpeechRecognition.available();
  if (!available) {
    handlers.onError("service-not-allowed");
    return null;
  }

  const permission = await SpeechRecognition.requestPermissions();
  if (permission.speechRecognition !== "granted") {
    handlers.onError("not-allowed");
    return null;
  }

  // Android delivers everything through partialResults, including the last
  // one before it stops, so the newest partial is also the final answer.
  let latest = "";
  let finished = false;
  let poll: ReturnType<typeof setInterval> | null = null;

  const partial = await SpeechRecognition.addListener("partialResults", (data) => {
    const text = data.matches?.[0];
    if (!text) return;
    latest = text;
    handlers.onPartial(text);
  });

  const finish = async () => {
    if (finished) return;
    finished = true;
    if (poll) clearInterval(poll);
    await partial.remove().catch(() => {});
    if (latest) handlers.onFinal(latest);
    else handlers.onError("no-speech");
    handlers.onEnd();
  };

  try {
    const result = await SpeechRecognition.start({
      language: lang,
      maxResults: 1,
      partialResults: true,
      // popup false: the app already shows that it is listening, and a
      // system dialog on top of that would be redundant and jarring.
      popup: false,
    });
    const match = result?.matches?.[0];
    if (match) latest = match;
  } catch (error) {
    finished = true;
    await partial.remove().catch(() => {});
    handlers.onError(String(error).toLowerCase().includes("permission") ? "not-allowed" : "audio-capture");
    handlers.onEnd();
    return null;
  }

  // The plugin advertises a listeningState event, but on this Android it
  // never fires and start() resolves with nothing - verified on device - so
  // waiting for either would leave the session open forever. Asking the
  // recogniser whether it is still listening works on every version.
  const startedAt = Date.now();
  poll = setInterval(() => {
    void (async () => {
      if (finished) return;
      const stillGoing = await SpeechRecognition.isListening()
        .then((r) => r.listening)
        .catch(() => false);
      if (!stillGoing || Date.now() - startedAt > MAX_UTTERANCE_MS) {
        // Not awaited: stop() does not resolve on this device - verified on
        // hardware - so awaiting it left finish() unreachable and the
        // microphone button stuck on "Stop" forever while the poll span on.
        void SpeechRecognition.stop().catch(() => {});
        await finish();
      }
    })();
  }, POLL_MS);

  return {
    stop: () => {
      // Same reasoning: tell the recogniser to stop, but close the session
      // on our own terms rather than waiting for a promise that may never
      // settle.
      void SpeechRecognition.stop().catch(() => {});
      void finish();
    },
  };
}

// Returns null when no engine could be started at all, in which case the
// caller shows the "not supported" message rather than a live microphone.
export async function startListening(
  lang: string,
  handlers: SpeechHandlers,
): Promise<SpeechSession | null> {
  return Capacitor.isNativePlatform()
    ? startNative(lang, handlers)
    : startWeb(lang, handlers);
}
