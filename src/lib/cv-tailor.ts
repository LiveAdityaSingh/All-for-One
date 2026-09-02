// The verified claims ledger (build spec §6) - Tony's differentiating
// feature. Tony may only assemble bullets from claims the user has
// explicitly confirmed, and must flag - never invent - anything a job
// description asks for that isn't backed by a confirmed claim.
import { chatCompletion, MODEL_CHAIN, MissingKeyError, RateLimitedError } from "./llm";
import type { Claim } from "./types";

export interface TailoringSuggestion {
  bullet: string;
  sourceClaimId: string;
}

export interface TailoringResult {
  suggestions: TailoringSuggestion[];
  gaps: string[]; // things the JD wants that no confirmed claim supports
}

interface RawModelOutput {
  suggestions: { bullet: string; source_claim_id: string }[];
  gaps: string[];
}

function buildPrompt(confirmedClaims: Claim[], jobDescription: string): string {
  const claimsList = confirmedClaims
    .map((c) => `- [${c.id}] ${c.text}`)
    .join("\n");

  return [
    "You are drafting CV bullet suggestions for a real job application.",
    "You MUST NOT invent, embellish, or infer any skill, achievement, or",
    "experience that is not explicitly listed below. Every suggested bullet",
    "must be a light rewording of exactly one claim, and must include that",
    "claim's id. If the job description asks for something no claim below",
    "supports, list it under \"gaps\" instead of writing a bullet for it.",
    "",
    "Confirmed claims (the ONLY material you may draw from):",
    claimsList || "(none)",
    "",
    "Job description:",
    jobDescription,
    "",
    "Respond with strict JSON only, matching this shape:",
    '{"suggestions": [{"bullet": string, "source_claim_id": string}], "gaps": [string]}',
  ].join("\n");
}

// Defence in depth: even if the model ignores the instruction, drop any
// suggestion that doesn't cite a claim id we actually gave it.
function verifySuggestions(
  raw: RawModelOutput,
  confirmedClaims: Claim[],
): TailoringSuggestion[] {
  const validIds = new Set(confirmedClaims.map((c) => c.id));
  return raw.suggestions
    .filter((s) => validIds.has(s.source_claim_id))
    .map((s) => ({ bullet: s.bullet, sourceClaimId: s.source_claim_id }));
}

export async function tailorCvForJob(
  allClaims: Claim[],
  jobDescription: string,
): Promise<TailoringResult> {
  const confirmedClaims = allClaims.filter((c) => c.confirmed);

  // Same chain as capture: whichever provider the user has a key for and
  // that answers first. Tailoring is user-initiated, so it can wait longer.
  let raw: string | null = null;
  let lastError: unknown = null;

  for (const choice of MODEL_CHAIN.tailoring) {
    try {
      raw = await chatCompletion(
        [
          { role: "system", content: "You output strict JSON and nothing else." },
          { role: "user", content: buildPrompt(confirmedClaims, jobDescription) },
        ],
        { provider: choice.provider, model: choice.model, timeoutMs: 25000 },
      );
      break;
    } catch (error) {
      lastError = error;
      if (error instanceof MissingKeyError || error instanceof RateLimitedError) continue;
    }
  }

  if (raw === null) {
    throw lastError instanceof Error
      ? lastError
      : new Error("No model was able to answer. Check your API keys in Settings.");
  }

  let parsed: RawModelOutput;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Could not parse tailoring response as JSON.");
  }

  return {
    suggestions: verifySuggestions(parsed, confirmedClaims),
    gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
  };
}
