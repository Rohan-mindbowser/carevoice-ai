import type { RequestHandler } from 'express';
import { ChatRequestSchema, ChatResponseSchema } from '@carevoice/schemas';
import type { Orchestrator } from '../ai/orchestrator.js';
import { devAuthContext } from '../security/authorization.js';

/**
 * Thin chat handler (spec §37): validate input, resolve the orchestrator, delegate, validate output.
 * Business logic lives in the orchestrator. Auth is a dev identity until Phase 12 derives it from a
 * verified token.
 */
export function createChatHandler(resolveOrchestrator: () => Orchestrator): RequestHandler {
  return (req, res, next) => {
    void (async () => {
      const parsed = ChatRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: { message: 'Invalid chat request', requestId: req.requestId } });
        return;
      }

      let orchestrator: Orchestrator;
      try {
        orchestrator = resolveOrchestrator();
      } catch {
        res.status(503).json({ error: { message: 'AI service is not configured', requestId: req.requestId } });
        return;
      }

      try {
        const result = await orchestrator.handleTurn({
          message: parsed.data.message,
          conversationId: parsed.data.conversationId,
          auth: devAuthContext(),
          requestId: req.requestId,
        });
        res.json(ChatResponseSchema.parse(result));
      } catch (error) {
        next(error);
      }
    })();
  };
}
