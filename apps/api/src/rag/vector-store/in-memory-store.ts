import type { ScoredRecord, VectorQueryOptions, VectorRecord, VectorStore } from '../types.js';

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/** In-memory cosine-similarity store for tests and offline development — no Pinecone required. */
export class InMemoryVectorStore implements VectorStore {
  private readonly records = new Map<string, VectorRecord>();

  async upsert(records: VectorRecord[]): Promise<void> {
    for (const record of records) {
      this.records.set(record.id, record);
    }
  }

  async query(vector: number[], options: VectorQueryOptions): Promise<ScoredRecord[]> {
    const passesFilter = (record: VectorRecord): boolean => {
      if (!options.filter) return true;
      const metadata = record.metadata as unknown as Record<string, unknown>;
      return Object.entries(options.filter).every(([key, value]) => metadata[key] === value);
    };

    return [...this.records.values()]
      .filter(passesFilter)
      .map((record) => ({ id: record.id, score: cosineSimilarity(vector, record.values), metadata: record.metadata }))
      .filter((record) => record.score >= (options.minScore ?? Number.NEGATIVE_INFINITY))
      .sort((a, b) => b.score - a.score)
      .slice(0, options.topK);
  }
}
