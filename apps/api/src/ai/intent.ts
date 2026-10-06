import type { Intent } from '@carevoice/schemas';
import { IntentSchema } from '@carevoice/schemas';
import type { LlmClient } from './llm/llm-client.js';
import { INTENT_DETECTION_PROMPT } from './prompts/intent-detection.js';

/**
 * Classify a clinician's message into a structured {@link Intent} using one LLM call. The LLM
 * client validates output against the schema and retries on malformed output.
 *
 * This throws if the model call fails (e.g. rate limit / unavailable). It deliberately does NOT
 * swallow failures into `unknown` — `unknown` is a *successful* classification meaning "unclear
 * request", which the UI answers with a clarification; a failed call is a service error the UI
 * surfaces as "busy, retry" (spec §26). The orchestrator distinguishes the two.
 */
export async function detectIntent(llm: LlmClient, message: string): Promise<Intent> {
  return llm.generateStructured({
    system: INTENT_DETECTION_PROMPT.system,
    prompt: message,
    schema: IntentSchema,
  });
}
