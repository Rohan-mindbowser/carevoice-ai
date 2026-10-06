import type { Intent } from '@carevoice/schemas';
import { IntentSchema } from '@carevoice/schemas';
import type { LlmClient } from './llm/llm-client.js';
import { INTENT_DETECTION_PROMPT } from './prompts/intent-detection.js';
import { logger } from '../observability/logger.js';

/**
 * Classify a clinician's message into a structured {@link Intent} using one LLM call. The LLM
 * client validates output against the schema and retries; if it still fails, we fall back to
 * `unknown` rather than guessing a patient action (spec §13 controlled safe failure).
 */
export async function detectIntent(llm: LlmClient, message: string): Promise<Intent> {
  try {
    return await llm.generateStructured({
      system: INTENT_DETECTION_PROMPT.system,
      prompt: message,
      schema: IntentSchema,
    });
  } catch (error) {
    logger.warn(
      { event: 'intent_detection_failed', err: error instanceof Error ? error.message : 'unknown' },
      'intent.fallback',
    );
    return { intent: 'unknown' };
  }
}
