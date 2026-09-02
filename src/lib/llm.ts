// Direct device-to-API calls to free-tier models (decided: no backend
// proxy for v1). Each user supplies their own keys, stored only in this
// device's localStorage - never bundled into the app itself. That sidesteps
// the key-extraction risk of shipping one shared key inside every install,
// and it means a free account's quota belongs to one person.
//
// Two providers, because a free tier is not a reliable dependency:
//   Groq       - fastest, strict structured outputs, and a far larger free
//                daily quota (documented 100-2,000 requests/day by model).
//   OpenRouter - widest model choice, but only 50 free requests per day
//                without credits, measured from its own 429 header.
//
// Both answer CORS preflights with `Access-Control-Allow-Origin: *`, which
// is what makes browser-direct calls possible at all - NVIDIA's own API
// returns no such header and blocks the request outright.

export type Provider = "groq" | "openrouter";

const STORAGE_KEYS: Record<Provider, string> = {
  groq: "groq_api_key",
  openrouter: "openrouter_api_key",
};

const ENDPOINTS: Record<Provider, string> = {
  groq: "https://api.groq.com/openai/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
};

export const PROVIDER_LABELS: Record<Provider, string> = {
  groq: "Groq",
  openrouter: "OpenRouter",
};

export interface ModelChoice {
  provider: Provider;
  model: string;
}

// Tried in order; the first that has a key and answers wins. Free models
// get retired without notice - a previous pick, Llama 3.3 70B, vanished
// from OpenRouter entirely and every call 404'd - so this is a chain
// rather than a single id.
export const MODEL_CHAIN: Record<"intent" | "tailoring", ModelChoice[]> = {
  // Intent extraction is classification, not reasoning: small and fast
  // wins. gpt-oss-20b is the quickest model on Groq's fleet that still
  // supports strict schema compliance.
  intent: [
    { provider: "groq", model: "openai/gpt-oss-20b" },
    { provider: "openrouter", model: "nvidia/nemotron-3-super-120b-a12b:free" },
    { provider: "openrouter", model: "dots-studio/dots-3-note-preview:free" },
  ],
  // Tailoring is user-initiated and genuinely reasoning-shaped, so it can
  // afford a larger, slower model.
  tailoring: [
    { provider: "groq", model: "openai/gpt-oss-120b" },
    { provider: "openrouter", model: "nvidia/nemotron-3-super-120b-a12b:free" },
  ],
};

export function getApiKey(provider: Provider): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEYS[provider]);
}

export function setApiKey(provider: Provider, key: string): void {
  window.localStorage.setItem(STORAGE_KEYS[provider], key);
}

export function clearApiKey(provider: Provider): void {
  window.localStorage.removeItem(STORAGE_KEYS[provider]);
}

export function hasAnyKey(): boolean {
  return getApiKey("groq") !== null || getApiKey("openrouter") !== null;
}

export function isOnline(): boolean {
  return typeof navigator === "undefined" ? false : navigator.onLine;
}

// A quota rejection is per-provider and usually daily, so the caller should
// abandon that provider for this attempt rather than retry its other models.
export class RateLimitedError extends Error {
  constructor(readonly provider: Provider) {
    super(`${PROVIDER_LABELS[provider]} rate limit reached.`);
  }
}

export class MissingKeyError extends Error {}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionOptions {
  provider?: Provider;
  model?: string;
  // A JSON schema turns "please return JSON" from a hope into a contract.
  schema?: { name: string; schema: Record<string, unknown> };
  // Voice capture has a latency budget: past a few seconds the app feels
  // broken, so a slow model must lose rather than block the loop.
  timeoutMs?: number;
}

export async function chatCompletion(
  messages: ChatMessage[],
  options: CompletionOptions = {},
): Promise<string> {
  const provider = options.provider ?? "openrouter";
  const apiKey = getApiKey(provider);
  if (!apiKey) {
    throw new MissingKeyError(`No ${PROVIDER_LABELS[provider]} API key set.`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 20000);

  try {
    const response = await fetch(ENDPOINTS[provider], {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options.model ?? MODEL_CHAIN.intent[0].model,
        messages,
        temperature: 0.1,
        ...(options.schema
          ? {
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: options.schema.name,
                  strict: true,
                  schema: options.schema.schema,
                },
              },
            }
          : {}),
      }),
    });

    if (response.status === 429) throw new RateLimitedError(provider);

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`${PROVIDER_LABELS[provider]} failed (${response.status}): ${body}`);
    }

    const data = await response.json();

    // OpenRouter reports upstream provider failures as HTTP 200 with an
    // `error` in the body, so status alone cannot tell success from
    // "Nvidia is overloaded".
    if (data?.error?.code === 429) throw new RateLimitedError(provider);
    if (data?.error) {
      throw new Error(
        `${PROVIDER_LABELS[provider]} upstream error (${data.error.code ?? "?"}): ` +
          `${data.error.message ?? "unknown"}`,
      );
    }

    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error(`${PROVIDER_LABELS[provider]} response had no message content.`);
    }
    return content;
  } finally {
    clearTimeout(timeout);
  }
}
