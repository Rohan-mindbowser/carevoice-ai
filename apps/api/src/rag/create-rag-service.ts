import { Pinecone } from '@pinecone-database/pinecone';
import { env } from '../config/env.js';
import { GeminiEmbedder } from './embeddings/gemini-embedder.js';
import { PineconeVectorStore } from './vector-store/pinecone-store.js';
import { RagService } from './rag-service.js';
import { RagError } from './errors.js';

let cached: RagService | undefined;

/** Builds the live RAG service (Gemini embeddings + Pinecone). Requires the relevant keys. */
export function createRagService(): RagService {
  if (!env.GOOGLE_GENAI_API_KEY) {
    throw new RagError('GOOGLE_GENAI_API_KEY is required for embeddings');
  }
  if (!env.PINECONE_API_KEY || !env.PINECONE_INDEX) {
    throw new RagError('PINECONE_API_KEY and PINECONE_INDEX are required');
  }

  const embedder = new GeminiEmbedder({
    apiKey: env.GOOGLE_GENAI_API_KEY,
    model: env.EMBEDDING_MODEL,
    dimension: env.EMBEDDING_DIM,
  });
  const pinecone = new Pinecone({ apiKey: env.PINECONE_API_KEY });
  const store = new PineconeVectorStore(pinecone.index(env.PINECONE_INDEX));

  return new RagService(embedder, store);
}

export function getRagService(): RagService {
  cached ??= createRagService();
  return cached;
}
