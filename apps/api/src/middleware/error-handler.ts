import type { ErrorRequestHandler, RequestHandler } from 'express';
import { logger } from '../observability/logger.js';

/**
 * Operational error with a client-safe message. Business/FHIR/AI layers throw this when they want
 * to control what the user sees; anything else becomes a generic 500.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly publicMessage: string,
    options?: { cause?: unknown },
  ) {
    super(publicMessage, options);
    this.name = 'AppError';
  }
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { message: 'Not found' } });
};

/**
 * Centralized error handler (spec §26). Users receive a friendly message; logs keep technical
 * detail but never PHI. Must keep the 4-arg signature so Express treats it as an error handler.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const status = err instanceof AppError ? err.statusCode : 500;
  const publicMessage = err instanceof AppError ? err.publicMessage : 'Internal server error';

  logger.error(
    {
      requestId: req.requestId,
      status,
      err: err instanceof Error ? err.message : 'unknown error',
    },
    'request failed',
  );

  res.status(status).json({ error: { message: publicMessage, requestId: req.requestId } });
};
