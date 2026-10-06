export interface TextChunk {
  index: number;
  text: string;
}

export interface ChunkOptions {
  /** Target max characters per chunk. */
  chunkSize: number;
  /** Characters of trailing context carried into the next chunk for continuity. */
  overlap: number;
}

/** Normalize whitespace and line endings before chunking. */
export function cleanText(input: string): string {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => sentence.length > 0);
}

/**
 * Split text into overlapping, sentence-aware chunks (spec §16). Packing on sentence boundaries
 * keeps chunks readable; the overlap preserves context across boundaries so a query that straddles
 * two chunks still retrieves a coherent passage. Chunk size and overlap are tunable.
 */
export function chunkText(text: string, options: ChunkOptions): TextChunk[] {
  const { chunkSize, overlap } = options;
  const sentences = splitSentences(text);
  const chunks: TextChunk[] = [];
  let current: string[] = [];
  let currentLen = 0;
  let index = 0;

  const flush = (): void => {
    if (current.length === 0) return;
    chunks.push({ index, text: current.join(' ') });
    index += 1;
  };

  for (const sentence of sentences) {
    if (currentLen + sentence.length + 1 > chunkSize && current.length > 0) {
      flush();
      // Carry trailing sentences (up to `overlap` chars) into the next chunk.
      const carried: string[] = [];
      let carriedLen = 0;
      for (let i = current.length - 1; i >= 0; i--) {
        const sent = current[i];
        if (sent === undefined) continue;
        if (carriedLen + sent.length + 1 > overlap) break;
        carried.unshift(sent);
        carriedLen += sent.length + 1;
      }
      current = carried;
      currentLen = carriedLen;
    }
    current.push(sentence);
    currentLen += sentence.length + 1;
  }
  flush();
  return chunks;
}
