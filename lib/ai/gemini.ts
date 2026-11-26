import "server-only";
import { ApiError, GoogleGenAI } from "@google/genai";

export type AiErrorKind = "not_configured" | "rate_limited" | "timeout" | "unavailable" | "bad_output";

/** An AI failure with a message safe to show. */
export class AiError extends Error {
  constructor(
    readonly kind: AiErrorKind,
    message: string,
    /** Technical detail for server logs (status and model). Never includes the user's text. */
    readonly detail?: string,
  ) {
    super(message);
    this.name = "AiError";
  }
}

let client: GoogleGenAI | undefined;
function gemini(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AiError("not_configured", "AI isn't set up on this server.");
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

/** Models to try in order: the main free-tier model, then a fallback when it's rate-limited or down. */
function models(): string[] {
  return [process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite", process.env.GEMINI_FALLBACK_MODEL].filter(
    (m, i, all): m is string => Boolean(m) && all.indexOf(m) === i,
  );
}

/** Overloaded or erroring: worth a retry on the same model after a short wait. */
const TRANSIENT = new Set([500, 502, 503, 504]);
/** Rate-limited or model not found: go straight to the next model. */
const NEXT_MODEL = new Set([404, 429]);
const ATTEMPTS_PER_MODEL = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface JsonRequest {
  system: string;
  prompt: string;
  jsonSchema: unknown;
  /** Per attempt. */
  timeoutMs?: number;
  /** For the whole call, across retries and models, so a user never waits too long. */
  budgetMs?: number;
}

/**
 * Ask Gemini for JSON matching `jsonSchema`. Temperature 0 for repeatable extraction.
 * Each model gets up to 3 attempts on overload or timeout (exponential backoff with jitter),
 * then the fallback model is tried, all within `budgetMs`.
 */
export async function generateJson(opts: JsonRequest): Promise<{ data: unknown; model: string; attempts: number }> {
  const ai = gemini();
  const deadline = Date.now() + (opts.budgetMs ?? 45_000);
  let last = new AiError("unavailable", "AI is unavailable right now.");
  let attempts = 0;

  for (const model of models()) {
    for (let attempt = 0; attempt < ATTEMPTS_PER_MODEL; attempt++) {
      if (attempt > 0) {
        const wait = 700 * 2 ** (attempt - 1) + Math.random() * 400;
        if (Date.now() + wait >= deadline) throw last;
        await sleep(wait);
      }
      const remaining = deadline - Date.now();
      if (remaining < 1_000) throw last;
      attempts += 1;
      const result = await attemptOnce(ai, model, opts, Math.min(opts.timeoutMs ?? 20_000, remaining));
      if (result.ok) return { data: result.data, model, attempts };
      last = result.error;
      if (result.next === "model") break;
    }
  }
  throw last;
}

type Attempt = { ok: true; data: unknown } | { ok: false; error: AiError; next: "retry" | "model" };

async function attemptOnce(ai: GoogleGenAI, model: string, opts: JsonRequest, timeoutMs: number): Promise<Attempt> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await ai.models.generateContent({
      model,
      contents: opts.prompt,
      config: {
        systemInstruction: opts.system,
        responseMimeType: "application/json",
        responseJsonSchema: opts.jsonSchema,
        temperature: 0,
        abortSignal: controller.signal,
      },
    });
    const text = res.text;
    if (!text) return { ok: false, error: new AiError("bad_output", "The AI returned an empty answer.", model), next: "retry" };
    try {
      return { ok: true, data: JSON.parse(text) };
    } catch {
      return { ok: false, error: new AiError("bad_output", "The AI's answer wasn't valid JSON.", model), next: "retry" };
    }
  } catch (error) {
    if (controller.signal.aborted) {
      return {
        ok: false,
        error: new AiError("timeout", "The AI took too long. Try again in a minute.", `${model}: timeout`),
        next: "retry",
      };
    }
    if (error instanceof ApiError && (TRANSIENT.has(error.status) || NEXT_MODEL.has(error.status))) {
      const detail = `${model}: HTTP ${error.status} ${error.message.slice(0, 200)}`;
      const aiError =
        error.status === 429
          ? new AiError("rate_limited", "The free AI limit is reached for now. Try again in a minute.", detail)
          : new AiError("unavailable", "The AI is busy right now (free tier). Try again in a minute.", detail);
      return { ok: false, error: aiError, next: TRANSIENT.has(error.status) ? "retry" : "model" };
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
