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

/**
 * Builds the Express app. Express-free business logic lives elsewhere (spec §14/§37); this file
 * only wires transport-level concerns: security headers, CORS, body limits, correlation ids,
 * request logging, rate limiting, routes, and centralized error handling.
 */
export function createApp(): Express {
  const app = express();

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

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
