import { GoogleGenAI } from '@google/genai';
import type { Embedder } from '../types.js';
import { RagError } from '../errors.js';

export interface GeminiEmbedderConfig {
  apiKey: string;
  model: string;
  /** Output dimension — must match the Pinecone index dimension. */
  dimension: number;
}

/** Gemini-backed embedder via the Google GenAI SDK. */
export class GeminiEmbedder implements Embedder {
  private readonly ai: GoogleGenAI;

  constructor(private readonly config: GeminiEmbedderConfig) {
    this.ai = new GoogleGenAI({ apiKey: config.apiKey });
  }

  private async embed(texts: string[]): Promise<number[][]> {
    const response = await this.ai.models.embedContent({
      model: this.config.model,
      contents: texts,
      config: { outputDimensionality: this.config.dimension },
    });
    const embeddings = response.embeddings ?? [];
    if (embeddings.length !== texts.length) {
      throw new RagError('Embedding count did not match input count');
    }
    return embeddings.map((embedding) => {
      if (!embedding.values || embedding.values.length === 0) {
        throw new RagError('Received an empty embedding');
      }
      return embedding.values;
    });
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return texts.length > 0 ? this.embed(texts) : [];
  }

  async embedQuery(text: string): Promise<number[]> {
    const [vector] = await this.embed([text]);
    if (!vector) throw new RagError('Received an empty embedding');
    return vector;
  }
}
