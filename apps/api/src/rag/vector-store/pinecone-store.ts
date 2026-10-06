import type { Index, RecordMetadata } from '@pinecone-database/pinecone';
import type { RagSourceType } from '@carevoice/schemas';
import type { ScoredRecord, StoredMetadata, VectorQueryOptions, VectorRecord, VectorStore } from '../types.js';

/** Build Pinecone metadata, omitting undefined (Pinecone rejects undefined values). */
function toRecordMetadata(metadata: StoredMetadata): RecordMetadata {
  const record: RecordMetadata = {
    documentId: metadata.documentId,
    documentName: metadata.documentName,
    chunkIndex: metadata.chunkIndex,
    sourceType: metadata.sourceType,
    text: metadata.text,
  };
  if (metadata.section !== undefined) record.section = metadata.section;
  if (metadata.page !== undefined) record.page = metadata.page;
  return record;
}

/** Reconstruct our StoredMetadata from Pinecone's loosely-typed metadata. */
function fromRecordMetadata(raw: RecordMetadata | undefined): StoredMetadata {
  const data = raw ?? {};
  return {
    documentId: String(data.documentId ?? ''),
    documentName: String(data.documentName ?? ''),
    chunkIndex: Number(data.chunkIndex ?? 0),
    sourceType: (data.sourceType as RagSourceType) ?? 'other',
    text: String(data.text ?? ''),
    section: data.section !== undefined ? String(data.section) : undefined,
    page: data.page !== undefined ? Number(data.page) : undefined,
  };
}

/** Pinecone-backed vector store. All Pinecone specifics are contained here. */
export class PineconeVectorStore implements VectorStore {
  constructor(private readonly index: Index) {}

  async upsert(records: VectorRecord[]): Promise<void> {
    await this.index.upsert({
      records: records.map((record) => ({
        id: record.id,
        values: record.values,
        metadata: toRecordMetadata(record.metadata),
      })),
    });
  }

  async query(vector: number[], options: VectorQueryOptions): Promise<ScoredRecord[]> {
    const response = await this.index.query({
      vector,
      topK: options.topK,
      includeMetadata: true,
      filter: options.filter,
    });
    const minScore = options.minScore ?? Number.NEGATIVE_INFINITY;
    return (response.matches ?? [])
      .filter((match) => (match.score ?? 0) >= minScore)
      .map((match) => ({
        id: match.id,
        score: match.score ?? 0,
        metadata: fromRecordMetadata(match.metadata),
      }));
  }
}
