import type { GenerateStructuredArgs, GenerateTextArgs, LlmClient } from './llm-client.js';

export interface FakeLlmResponses {
  /** Raw value returned for generateStructured; validated against the caller's schema. */
  structured?: unknown;
  /** Text returned for generateText. */
  text?: string;
  /** When true, generateStructured throws (to exercise the orchestrator's safe-fail path). */
  throwStructured?: boolean;
}

/**
 * Deterministic in-memory LLM for tests — no network, no cost. Records the last call args so tests
 * can assert what was sent to the model (e.g. that PATIENT DATA was included in the prompt).
 */
export class FakeLlmClient implements LlmClient {
  lastStructured?: GenerateStructuredArgs<unknown>;
  lastText?: GenerateTextArgs;

  constructor(private readonly responses: FakeLlmResponses = {}) {}

  async generateStructured<T>(args: GenerateStructuredArgs<T>): Promise<T> {
    this.lastStructured = args;
    if (this.responses.throwStructured) {
      throw new Error('fake structured failure');
    }
    // Validate exactly as the real client does, so tests catch schema mismatches.
    return args.schema.parse(this.responses.structured);
  }

  async generateText(args: GenerateTextArgs): Promise<string> {
    this.lastText = args;
    return this.responses.text ?? 'Fake clinical response.';
  }
}
