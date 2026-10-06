import type { Embedder } from '../types.js';

/** FNV-1a hash → deterministic bucket per token. */
function hashToken(token: string): number {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Deterministic bag-of-words hashing embedder for tests — no network, no cost. Texts that share
 * vocabulary get similar vectors, so cosine similarity is meaningful enough to test retrieval.
 */
export class FakeEmbedder implements Embedder {
  constructor(private readonly dim = 256) {}

  private embedOne(text: string): number[] {
    const vector = new Array<number>(this.dim).fill(0);
    const tokens = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    for (const token of tokens) {
      const idx = hashToken(token) % this.dim;
      vector[idx] = (vector[idx] ?? 0) + 1;
    }
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
    return vector.map((value) => value / norm);
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return texts.map((text) => this.embedOne(text));
  }

  async embedQuery(text: string): Promise<number[]> {
    return this.embedOne(text);
  }
}
