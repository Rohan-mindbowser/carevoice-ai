import { env } from '../../config/env.js';
import type { LlmClient } from './llm-client.js';
import { GeminiClient } from './gemini-client.js';
import { LlmError } from './errors.js';

let cached: LlmClient | undefined;

/** Builds the live LLM client. Requires a configured API key (we wire Gemini live, per project decision). */
export function createLlmClient(): LlmClient {
  if (!env.GOOGLE_GENAI_API_KEY) {
    throw new LlmError('GOOGLE_GENAI_API_KEY is not configured');
  }
  return new GeminiClient({ apiKey: env.GOOGLE_GENAI_API_KEY, model: env.GEMINI_MODEL });
}

export function getLlmClient(): LlmClient {
  cached ??= createLlmClient();
  return cached;
}
