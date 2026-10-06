import { Router } from 'express';
import { HealthResponseSchema, ReadinessResponseSchema } from '@carevoice/schemas';
import { APP_NAME } from '@carevoice/shared';

export const healthRouter: Router = Router();

const startedAt = Date.now();

// Liveness: the process is up and serving.
healthRouter.get('/health', (_req, res) => {
  const body = HealthResponseSchema.parse({
    status: 'ok',
    service: APP_NAME,
    version: process.env.npm_package_version ?? '0.1.0',
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
  });
  res.json(body);
});

// Readiness: later phases probe FHIR/Pinecone/Gemini here. For now, being up is enough.
healthRouter.get('/readiness', (_req, res) => {
  const body = ReadinessResponseSchema.parse({
    status: 'ready',
    checks: { server: 'ok' },
  });
  res.json(body);
});
