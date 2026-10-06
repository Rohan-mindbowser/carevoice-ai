/**
 * Ingest approved knowledge documents into the live vector store (Gemini embeddings + Pinecone).
 *   pnpm --filter @carevoice/api rag:ingest [dir]
 * Defaults to the repo's data/documents directory. Requires Gemini + Pinecone keys, and
 * EMBEDDING_DIM must match the Pinecone index dimension.
 */
import { resolve } from 'node:path';
import { getRagService } from './create-rag-service.js';
import { loadDocumentsFromDir } from './loader.js';

async function main(): Promise<void> {
  const dir = resolve(process.argv[2] ?? 'data/documents');
  const rag = getRagService();
  const documents = await loadDocumentsFromDir(dir);
  console.log(`Loaded ${documents.length} document(s) from ${dir}`);

  for (const doc of documents) {
    const result = await rag.ingestDocument(doc);
    console.log(`  • ${doc.documentName}: ${result.chunks} chunk(s) ingested`);
  }
}

main().catch((error: unknown) => {
  console.error('RAG ingest failed:', error);
  process.exit(1);
});
