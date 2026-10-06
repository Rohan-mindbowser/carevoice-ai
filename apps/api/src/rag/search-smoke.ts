/**
 * Query the live vector store and print cited results. Not part of the suite.
 *   pnpm --filter @carevoice/api rag:search "when do I start vasopressors in sepsis?"
 */
import { getRagService } from './create-rag-service.js';

async function main(): Promise<void> {
  const query = process.argv[2] ?? 'What is the one-hour sepsis bundle?';
  const rag = getRagService();
  const results = await rag.search(query, { topK: 3 });

  console.log(`Query: ${query}`);
  for (const result of results) {
    console.log(`\n[score ${result.score.toFixed(3)}] ${result.metadata.documentName} (chunk ${result.metadata.chunkIndex})`);
    console.log(result.text.slice(0, 200) + (result.text.length > 200 ? '…' : ''));
  }
}

main().catch((error: unknown) => {
  console.error('RAG search failed:', error);
  process.exit(1);
});
