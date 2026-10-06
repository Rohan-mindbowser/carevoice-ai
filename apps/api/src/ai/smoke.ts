/**
 * Manual check of the live Gemini layer (intent detection + tool selection). Not in the suite.
 *   pnpm --filter @carevoice/api ai:smoke "Find patient 12345 and give me the latest lab results."
 */
import { getLlmClient } from './llm/create-llm-client.js';
import { detectIntent } from './intent.js';
import { selectTool } from './tool-selection.js';

async function main(): Promise<void> {
  const message = process.argv[2] ?? 'Find patient 12345 and give me the latest lab results.';
  const llm = getLlmClient();

  const intent = await detectIntent(llm, message);
  console.log('Message:', message);
  console.log('Intent: ', intent);
  console.log('Tool:   ', selectTool(intent));
}

main().catch((error: unknown) => {
  console.error('AI smoke failed:', error);
  process.exit(1);
});
