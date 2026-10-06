import { describe, it, expect } from 'vitest';
import { chunkText, cleanText } from './chunk.js';

describe('cleanText', () => {
  it('normalizes whitespace and line endings', () => {
    expect(cleanText('a\r\n\n\n\nb   c\t d')).toBe('a\n\nb c d');
  });
});

describe('chunkText', () => {
  const text =
    'First sentence about sepsis. Second sentence about antibiotics. Third sentence about lactate. ' +
    'Fourth sentence about fluids. Fifth sentence about vasopressors. Sixth sentence about perfusion.';

  it('splits long text into multiple size-bounded chunks', () => {
    const chunks = chunkText(text, { chunkSize: 80, overlap: 20 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      // Allow a little slack since we pack whole sentences.
      expect(chunk.text.length).toBeLessThanOrEqual(120);
    }
    expect(chunks.map((c) => c.index)).toEqual(chunks.map((_c, i) => i));
  });

  it('carries overlap context between consecutive chunks', () => {
    const chunks = chunkText(text, { chunkSize: 80, overlap: 40 });
    const first = chunks[0];
    const second = chunks[1];
    expect(first && second).toBeTruthy();
    if (first && second) {
      const lastSentenceOfFirst = first.text.split(/(?<=[.!?])\s+/).at(-1) ?? '';
      expect(second.text).toContain(lastSentenceOfFirst);
    }
  });

  it('returns a single chunk when text fits', () => {
    expect(chunkText('Short text here.', { chunkSize: 1000, overlap: 100 })).toHaveLength(1);
  });

  it('returns no chunks for empty text', () => {
    expect(chunkText('', { chunkSize: 1000, overlap: 100 })).toHaveLength(0);
  });
});
