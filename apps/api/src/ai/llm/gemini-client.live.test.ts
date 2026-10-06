import { describe, it, expect } from 'vitest';
import { IntentSchema } from '@carevoice/schemas';
import { GeminiClient } from './gemini-client.js';
import { INTENT_DETECTION_PROMPT } from '../prompts/intent-detection.js';

/**
 * Live Gemini test. Gated on LLM_LIVE=1 so the normal suite stays hermetic even when a key is set:
 *   LLM_LIVE=1 pnpm --filter @carevoice/api test
 */
const LIVE = process.env.LLM_LIVE === '1' && Boolean(process.env.GOOGLE_GENAI_API_KEY);

describe.skipIf(!LIVE)('GeminiClient (live)', () => {
  const client = new GeminiClient({
    apiKey: process.env.GOOGLE_GENAI_API_KEY ?? '',
    model: process.env.GEMINI_MODEL ?? 'gemini-3.8-flash',
  });

  // Generous timeout: live calls plus transient-503 backoff can exceed vitest's 5s default.
  it('detects a patient-labs intent as validated structured output', async () => {
    const intent = await client.generateStructured({
      system: INTENT_DETECTION_PROMPT.system,
      prompt: 'Find patient 12345 and give me the latest lab results.',
      schema: IntentSchema,
    });
    expect(['latest_labs', 'patient_lookup']).toContain(intent.intent);
    expect(intent.patientId).toBe('12345');
  }, 30_000);

  it('generates free text for a general request', async () => {
    const text = await client.generateText({
      system: 'You are concise.',
      prompt: 'Reply with the single word: ready',
    });
    expect(text.toLowerCase()).toContain('ready');
  }, 30_000);
});
