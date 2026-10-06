import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import { API_BASE } from '@carevoice/shared';
import { corsOrigins } from './config/env.js';
import { logger } from './observability/logger.js';
import { requestId } from './middleware/request-id.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { healthRouter } from './routes/health.js';
import { createToolRegistry } from './mcp/tools/index.js';
import { createMcpHttpHandler } from './mcp/mcp-server.js';
import { createChatRouter } from './routes/chat.js';
import { createRagRouter } from './routes/rag.js';
import type { Orchestrator } from './ai/orchestrator.js';
import type { RagService } from './rag/rag-service.js';
import { getOrchestrator } from './ai/create-orchestrator.js';
import { getRagService } from './rag/create-rag-service.js';

export interface AppDeps {
  /** Override for tests; defaults to the live, lazily-constructed orchestrator. */
  resolveOrchestrator?: () => Orchestrator;
  /** Override for tests; defaults to the live, lazily-constructed RAG service. */
  resolveRag?: () => RagService;
}

/**
 * Builds the Express app. Express-free business logic lives elsewhere (spec §14/§37); this file
 * only wires transport-level concerns: security headers, CORS, body limits, correlation ids,
 * request logging, rate limiting, routes, and centralized error handling.
 */
export function createApp(deps: AppDeps = {}): Express {
  const app = express();
  const resolveOrchestrator = deps.resolveOrchestrator ?? getOrchestrator;
  const resolveRag = deps.resolveRag ?? getRagService;

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: corsOrigins, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  // requestId must run before the logger so every log line is correlated.
  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as unknown as { requestId?: string }).requestId ?? 'unknown',
    }),
  );

  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 100,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
  );

  app.use(API_BASE, healthRouter);
  app.use(API_BASE, createChatRouter(resolveOrchestrator));
  app.use(API_BASE, createRagRouter(resolveRag));

  // Standardized MCP endpoint — exposes healthcare tools to any MCP client (spec §8).
  // One handler instance so Streamable-HTTP sessions persist across initialize/call/close.
  const mcpHandler = createMcpHttpHandler(createToolRegistry());
  app.post('/mcp', mcpHandler);
  app.get('/mcp', mcpHandler);
  app.delete('/mcp', mcpHandler);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
