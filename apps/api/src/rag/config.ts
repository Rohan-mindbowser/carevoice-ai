/**
 * RAG retrieval tunables (spec §16). Defaults chosen for policy/guideline prose:
 * - chunkSize/overlap: ~1k-char chunks keep a coherent passage; 150-char overlap preserves context.
 * - topK: how many chunks to retrieve for the LLM context.
 * - minScore: 0 by default (no threshold) so the caller can tune per embedder — different embedders
 *   produce different score scales.
 */
export interface RagConfig {
  chunkSize: number;
  overlap: number;
  topK: number;
  minScore: number;
}

export const DEFAULT_RAG_CONFIG: RagConfig = {
  chunkSize: 1000,
  overlap: 150,
  topK: 5,
  minScore: 0,
};
