import type { RagChunkMetadata } from '@carevoice/schemas';

/** Produces embedding vectors. Behind an interface so Gemini (live) and a fake (tests) interchange. */
export interface Embedder {
  embedDocuments(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
}

/** Chunk metadata plus the chunk text, as persisted in the vector store. */
export type StoredMetadata = RagChunkMetadata & { text: string };

export interface VectorRecord {
  id: string;
  values: number[];
  metadata: StoredMetadata;
}

export interface VectorQueryOptions {
  topK: number;
  /** Drop results below this similarity score. Omit for no threshold. */
  minScore?: number;
  /** Exact-match metadata filter (e.g. by sourceType or documentId). */
  filter?: Record<string, string | number | boolean>;
}

export interface ScoredRecord {
  id: string;
  score: number;
  metadata: StoredMetadata;
}

/** Vector index. Pinecone (live) and an in-memory implementation (tests) both satisfy this. */
export interface VectorStore {
  upsert(records: VectorRecord[]): Promise<void>;
  query(vector: number[], options: VectorQueryOptions): Promise<ScoredRecord[]>;
}
