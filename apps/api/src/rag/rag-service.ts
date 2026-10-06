import type { RagDocument, RagSearchResult } from '@carevoice/schemas';
import type { Embedder, VectorStore } from './types.js';
import { chunkText, cleanText } from './chunk.js';
import { DEFAULT_RAG_CONFIG, type RagConfig } from './config.js';
import { RagError } from './errors.js';

export interface RagSearchOptions {
  topK?: number;
  minScore?: number;
  filter?: Record<string, string | number | boolean>;
}

/**
 * Orchestrates the RAG pipeline (spec §16): ingest = clean → chunk → embed → upsert; search =
 * embed query → vector search → citations. Depends only on the Embedder and VectorStore interfaces,
 * so the same logic runs against fakes (tests) or Gemini + Pinecone (live).
 */
export class RagService {
  constructor(
    private readonly embedder: Embedder,
    private readonly store: VectorStore,
    private readonly config: RagConfig = DEFAULT_RAG_CONFIG,
  ) {}

  async ingestDocument(doc: RagDocument): Promise<{ documentId: string; chunks: number }> {
    const chunks = chunkText(cleanText(doc.text), {
      chunkSize: this.config.chunkSize,
      overlap: this.config.overlap,
    });
    if (chunks.length === 0) {
      return { documentId: doc.documentId, chunks: 0 };
    }

    const vectors = await this.embedder.embedDocuments(chunks.map((chunk) => chunk.text));
    const records = chunks.map((chunk, i) => {
      const values = vectors[i];
      if (!values) throw new RagError('Missing embedding for a chunk');
      return {
        id: `${doc.documentId}:${chunk.index}`,
        values,
        metadata: {
          documentId: doc.documentId,
          documentName: doc.documentName,
          chunkIndex: chunk.index,
          sourceType: doc.sourceType,
          text: chunk.text,
        },
      };
    });

    await this.store.upsert(records);
    return { documentId: doc.documentId, chunks: records.length };
  }

  async search(query: string, options: RagSearchOptions = {}): Promise<RagSearchResult[]> {
    const vector = await this.embedder.embedQuery(query);
    const results = await this.store.query(vector, {
      topK: options.topK ?? this.config.topK,
      minScore: options.minScore ?? this.config.minScore,
      filter: options.filter,
    });

    // Preserve source metadata so answers can be cited (spec §17).
    return results.map((result) => ({
      text: result.metadata.text,
      score: result.score,
      metadata: {
        documentId: result.metadata.documentId,
        documentName: result.metadata.documentName,
        chunkIndex: result.metadata.chunkIndex,
        sourceType: result.metadata.sourceType,
        section: result.metadata.section,
        page: result.metadata.page,
      },
    }));
  }
}
