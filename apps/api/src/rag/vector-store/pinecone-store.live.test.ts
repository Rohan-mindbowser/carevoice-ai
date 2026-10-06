import { describe, it, expect } from 'vitest';
import { Pinecone } from '@pinecone-database/pinecone';
import { PineconeVectorStore } from './pinecone-store.js';
import { env } from '../../config/env.js';

/**
 * Live Pinecone roundtrip. Gated on RAG_LIVE=1 + Pinecone config. Uses RAW random vectors sized to
 * the index dimension, so it exercises the store against the real index WITHOUT spending embedding
 * quota. Pinecone is eventually consistent, so the read is retried.
 *   RAG_LIVE=1 pnpm --filter @carevoice/api test
 */
const LIVE =
  process.env.RAG_LIVE === '1' && Boolean(env.PINECONE_API_KEY) && Boolean(env.PINECONE_INDEX);

const DIM = env.EMBEDDING_DIM;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe.skipIf(!LIVE)('PineconeVectorStore (live)', () => {
  it('upserts and retrieves a record by vector similarity', async () => {
    const pinecone = new Pinecone({ apiKey: env.PINECONE_API_KEY ?? '' });
    const store = new PineconeVectorStore(pinecone.index(env.PINECONE_INDEX ?? ''));

    const id = `carevoice-test-${Date.now()}`;
    const values = Array.from({ length: DIM }, () => Math.random());
    await store.upsert([
      {
        id,
        values,
        metadata: {
          documentId: 'test-doc',
          documentName: 'Test Document',
          chunkIndex: 0,
          sourceType: 'other',
          text: 'roundtrip test chunk',
        },
      },
    ]);

    let found = false;
    for (let attempt = 0; attempt < 10 && !found; attempt++) {
      await sleep(1000);
      const results = await store.query(values, { topK: 5 });
      found = results.some((result) => result.id === id);
    }
    expect(found).toBe(true);
  }, 30_000);
});
