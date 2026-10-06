import { Router } from 'express';
import type { RagService } from '../rag/rag-service.js';
import { createRagSearchHandler, createRagIngestHandler } from '../controllers/rag-controller.js';

export function createRagRouter(resolveRag: () => RagService): Router {
  const router = Router();
  router.post('/rag/search', createRagSearchHandler(resolveRag));
  router.post('/rag/ingest', createRagIngestHandler(resolveRag));
  return router;
}
