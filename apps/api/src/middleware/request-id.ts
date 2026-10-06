import type { RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Correlation id for this request — safe to log and returned via the x-request-id header. */
      requestId: string;
    }
  }
}

/** Assigns a correlation id to every request (reusing a sane inbound one if provided). */
export const requestId: RequestHandler = (req, res, next) => {
  const inbound = req.header('x-request-id');
  const id = inbound && inbound.length > 0 && inbound.length <= 128 ? inbound : randomUUID();
  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
};
