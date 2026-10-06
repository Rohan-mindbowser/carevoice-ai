import { pino } from 'pino';
import { env } from '../config/env.js';

/**
 * PHI-safe structured logger (spec §21/§25).
 * Redaction is a defense-in-depth backstop: we never knowingly log PHI, but if a patient-shaped
 * field slips into a log object, these paths censor it. Logs should carry only safe identifiers
 * (requestId, conversationId, toolName, tenantId, userId).
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      '*.password',
      'token',
      '*.token',
      'accessToken',
      '*.accessToken',
      'patient',
      '*.patient',
      'name',
      '*.name',
    ],
    censor: '[REDACTED]',
  },
  // Pretty output only in local dev; structured JSON everywhere else (and in tests).
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
      : undefined,
});
