import { Router } from 'express';
import type { Orchestrator } from '../ai/orchestrator.js';
import { createChatHandler, createChatStreamHandler } from '../controllers/chat-controller.js';

export function createChatRouter(resolveOrchestrator: () => Orchestrator): Router {
  const router = Router();
  router.post('/chat', createChatHandler(resolveOrchestrator));
  router.post('/chat/stream', createChatStreamHandler(resolveOrchestrator));
  return router;
}
