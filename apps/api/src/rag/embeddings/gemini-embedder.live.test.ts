import { describe, it, expect } from 'vitest';
import { GeminiEmbedder } from './gemini-embedder.js';
import { env } from '../../config/env.js';

/**
 * Live embeddings test. Gated on RAG_LIVE=1 + a key so the normal suite stays hermetic and free:
 *   RAG_LIVE=1 pnpm --filter @carevoice/api test
 * Uses text-embedding-004 at its native 768 dims (independent of the project's index dimension).
 */
const LIVE = process.env.RAG_LIVE === '1' && Boolean(env.GOOGLE_GENAI_API_KEY);

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

describe.skipIf(!LIVE)('GeminiEmbedder (live)', () => {
  const embedder = new GeminiEmbedder({
    apiKey: env.GOOGLE_GENAI_API_KEY ?? '',
    model: 'gemini-embedding-001',
    dimension: 768,
  });

  it('embeds a query to the requested dimension', async () => {
    const vector = await embedder.embedQuery('sepsis antibiotics bundle');
    expect(vector).toHaveLength(768);
  }, 30_000);

  it('scores related text higher than unrelated text', async () => {
    const [a, b, c] = await embedder.embedDocuments([
      'administer broad-spectrum antibiotics for sepsis',
      'sepsis bundle antibiotics and lactate measurement',
      'the weather today is sunny and warm',
    ]);
    expect(a && b && c).toBeTruthy();
    if (a && b && c) {
      expect(cosine(a, b)).toBeGreaterThan(cosine(a, c));
    }
  }, 30_000);
});
