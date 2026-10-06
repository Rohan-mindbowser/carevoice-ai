/** Any failure in the RAG pipeline (embedding or vector store). Messages carry no PHI. */
export class RagError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'RagError';
  }
}
