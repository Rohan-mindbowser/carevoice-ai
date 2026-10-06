import type { ZodType } from 'zod';

export interface GenerateStructuredArgs<T> {
  system: string;
  prompt: string;
  /** Zod schema the output must satisfy; also drives the model's JSON schema. */
  schema: ZodType<T>;
  temperature?: number;
}

export interface GenerateTextArgs {
  system: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
}

/**
 * Provider-neutral LLM boundary (spec §13/§37). The orchestrator depends only on this, so the
 * concrete model (Gemini today) is swappable and tests use an in-memory fake instead of calling a
 * real API. `generateStructured` returns data already validated against the Zod schema.
 */
export interface LlmClient {
  generateStructured<T>(args: GenerateStructuredArgs<T>): Promise<T>;
  generateText(args: GenerateTextArgs): Promise<string>;
}
