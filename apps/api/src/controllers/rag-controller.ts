import type { RequestHandler } from 'express';
import { RagIngestRequestSchema, RagSearchRequestSchema } from '@carevoice/schemas';
import type { RagService } from '../rag/rag-service.js';

/** POST /rag/search — retrieve approved-knowledge chunks with citations. */
export function createRagSearchHandler(resolveRag: () => RagService): RequestHandler {
  return (req, res, next) => {
    void (async () => {
      const parsed = RagSearchRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: { message: 'Invalid search request', requestId: req.requestId } });
        return;
      }
      let rag: RagService;
      try {
        rag = resolveRag();
      } catch {
        res.status(503).json({ error: { message: 'Knowledge base is not configured', requestId: req.requestId } });
        return;
      }
      try {
        const results = await rag.search(parsed.data.query, { topK: parsed.data.topK });
        res.json({ results });
      } catch (error) {
        next(error);
      }
    })();
  };
}

/**
 * POST /rag/ingest — add approved documents to the knowledge base. This is an administrative,
 * write-style operation; RBAC (admin-only) is enforced here in Phase 12.
 */
export function createRagIngestHandler(resolveRag: () => RagService): RequestHandler {
  return (req, res, next) => {
    void (async () => {
      const parsed = RagIngestRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: { message: 'Invalid ingest request', requestId: req.requestId } });
        return;
      }
      let rag: RagService;
      try {
        rag = resolveRag();
      } catch {
        res.status(503).json({ error: { message: 'Knowledge base is not configured', requestId: req.requestId } });
        return;
      }
      try {
        const ingested = [];
        for (const doc of parsed.data.documents) {
          ingested.push(await rag.ingestDocument(doc));
        }
        res.json({ ingested });
      } catch (error) {
        next(error);
      }
    })();
  };
}
