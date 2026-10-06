import type { RequestHandler } from 'express';
import { ChatRequestSchema, ChatResponseSchema, type ChatStreamEvent } from '@carevoice/schemas';
import type { Orchestrator } from '../ai/orchestrator.js';
import { devAuthContext } from '../security/authorization.js';
import { logger } from '../observability/logger.js';

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

/**
 * Streaming chat handler (SSE, spec §9). Emits typed events as the turn progresses and streams the
 * reply token-by-token. A client disconnect aborts in-flight generation.
 */
export function createChatStreamHandler(resolveOrchestrator: () => Orchestrator): RequestHandler {
  return (req, res) => {
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

      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // disable proxy buffering so events flush immediately
      });

      const controller = new AbortController();
      req.on('close', () => controller.abort());

      const send = (event: ChatStreamEvent): void => {
        if (!res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      try {
        await orchestrator.streamTurn(
          {
            message: parsed.data.message,
            conversationId: parsed.data.conversationId,
            auth: devAuthContext(),
            requestId: req.requestId,
            signal: controller.signal,
          },
          send,
        );
      } catch (error) {
        logger.error(
          { requestId: req.requestId, err: error instanceof Error ? error.message : 'unknown' },
          'chat stream failed',
        );
        send({ type: 'error', message: 'An error occurred while generating the response.' });
      } finally {
        if (!res.writableEnded) res.end();
      }
    })();
  };
}
