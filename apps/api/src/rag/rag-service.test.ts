import { describe, it, expect, beforeEach } from 'vitest';
import type { RagDocument } from '@carevoice/schemas';
import { RagService } from './rag-service.js';
import { FakeEmbedder } from './embeddings/fake-embedder.js';
import { InMemoryVectorStore } from './vector-store/in-memory-store.js';

const sepsis: RagDocument = {
  documentId: 'sepsis',
  documentName: 'Sepsis Protocol',
  sourceType: 'guideline',
  text: 'Administer broad-spectrum antibiotics within one hour. Measure lactate and obtain blood cultures. Start vasopressors if hypotension persists.',
};

const handHygiene: RagDocument = {
  documentId: 'hand-hygiene',
  documentName: 'Hand Hygiene Policy',
  sourceType: 'policy',
  text: 'Perform hand hygiene before and after patient contact. Use alcohol-based hand rub or soap and water.',
};

describe('RagService (fake embedder + in-memory store)', () => {
  let rag: RagService;

  beforeEach(async () => {
    rag = new RagService(new FakeEmbedder(), new InMemoryVectorStore());
    await rag.ingestDocument(sepsis);
    await rag.ingestDocument(handHygiene);
  });

  it('retrieves the most relevant document with citation metadata', async () => {
    const results = await rag.search('which antibiotics and lactate for sepsis?', { topK: 3 });
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top?.metadata.documentName).toBe('Sepsis Protocol');
    expect(top?.metadata.documentId).toBe('sepsis');
    expect(typeof top?.metadata.chunkIndex).toBe('number');
    expect(top?.text).toContain('antibiotics');
  });

  it('ranks the hand-hygiene policy top for a hand-hygiene query', async () => {
    const results = await rag.search('alcohol hand rub before patient contact');
    expect(results[0]?.metadata.documentId).toBe('hand-hygiene');
  });

  it('applies a metadata filter', async () => {
    const results = await rag.search('patient care', { filter: { sourceType: 'policy' }, topK: 5 });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.metadata.sourceType === 'policy')).toBe(true);
  });

  it('applies a minScore threshold', async () => {
    const results = await rag.search('completely unrelated astrophysics query', { minScore: 0.99 });
    expect(results).toHaveLength(0);
  });

  it('reports chunk count on ingest', async () => {
    const fresh = new RagService(new FakeEmbedder(), new InMemoryVectorStore());
    const result = await fresh.ingestDocument(sepsis);
    expect(result.documentId).toBe('sepsis');
    expect(result.chunks).toBeGreaterThan(0);
  });
});
