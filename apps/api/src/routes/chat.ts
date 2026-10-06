import { Router } from 'express';
import type { Orchestrator } from '../ai/orchestrator.js';
import { createChatHandler } from '../controllers/chat-controller.js';

export function createChatRouter(resolveOrchestrator: () => Orchestrator): Router {
  const router = Router();
  router.post('/chat', createChatHandler(resolveOrchestrator));
  return router;
}
