import { GoogleGenAI } from '@google/genai';
import { z, type ZodType } from 'zod';
import type { GenerateStructuredArgs, GenerateTextArgs, LlmClient } from './llm-client.js';
import { LlmError, LlmValidationError } from './errors.js';
import { logger } from '../../observability/logger.js';

export interface GeminiConfig {
  apiKey: string;
  model: string;
}

const STRUCTURED_MAX_ATTEMPTS = 2;
const API_MAX_ATTEMPTS = 3;

/** Zod → JSON Schema for Gemini's responseJsonSchema. Strips meta keys Gemini doesn't accept. */
function toResponseJsonSchema(schema: ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

/**
 * Transient, worth-retrying conditions: server overload (503 / UNAVAILABLE) only.
 * Deliberately NOT 429 / RESOURCE_EXHAUSTED — a quota 429 carries a long retry-after, so retrying
 * just burns more quota. Those fail fast and the caller falls back safely (spec §13/§26).
 */
function isTransient(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b503\b/.test(message) || /UNAVAILABLE|overloaded|high demand/i.test(message);
}

/** Retry a model call with exponential backoff on transient errors (spec §23). */
async function withApiRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < API_MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isTransient(error) || attempt === API_MAX_ATTEMPTS - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt + Math.random() * 200));
    }
  }
  throw lastError instanceof Error ? lastError : new LlmError('LLM call failed');
}

/**
 * Gemini-backed {@link LlmClient} using the Google GenAI SDK.
 *
 * Structured calls use JSON response mode + a response JSON schema for reliability, but output is
 * ALWAYS re-validated with Zod and retried once on failure before giving up (spec §13: never blindly
 * trust model output). Prompt/response bodies are never logged — they may contain PHI (spec §21).
 */
export class GeminiClient implements LlmClient {
  private readonly ai: GoogleGenAI;

  constructor(private readonly config: GeminiConfig) {
    this.ai = new GoogleGenAI({ apiKey: config.apiKey });
  }

  async generateStructured<T>(args: GenerateStructuredArgs<T>): Promise<T> {
    const jsonSchema = toResponseJsonSchema(args.schema);
    let lastError: unknown;

    for (let attempt = 1; attempt <= STRUCTURED_MAX_ATTEMPTS; attempt++) {
      const correction =
        attempt === 1
          ? ''
          : '\n\nYour previous response was invalid. Respond with ONLY valid JSON matching the schema.';
      const start = performance.now();

      const response = await withApiRetry(() =>
        this.ai.models.generateContent({
          model: this.config.model,
          contents: args.prompt + correction,
          config: {
            systemInstruction: args.system,
            responseMimeType: 'application/json',
            responseJsonSchema: jsonSchema,
            temperature: args.temperature ?? 0,
          },
        }),
      );

      logger.debug(
        { event: 'llm_call', kind: 'structured', model: this.config.model, attempt, latencyMs: Math.round(performance.now() - start) },
        'llm.generate_structured',
      );

      const text = response.text;
      if (!text) {
        lastError = new LlmError('Empty LLM response');
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (error) {
        lastError = error;
        continue;
      }

      const validated = args.schema.safeParse(parsed);
      if (validated.success) {
        return validated.data;
      }
      lastError = new LlmValidationError('LLM output failed schema validation');
    }

    throw new LlmValidationError('Structured generation failed after retries', { cause: lastError });
  }

  async generateText(args: GenerateTextArgs): Promise<string> {
    const response = await withApiRetry(() =>
      this.ai.models.generateContent({
        model: this.config.model,
        contents: args.prompt,
        config: {
          systemInstruction: args.system,
          temperature: args.temperature ?? 0.2,
          maxOutputTokens: args.maxOutputTokens,
        },
      }),
    );
    const text = response.text;
    if (!text) {
      throw new LlmError('Empty LLM response');
    }
    return text;
  }
}
