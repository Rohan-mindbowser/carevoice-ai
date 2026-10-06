import { z } from 'zod';

/**
 * Shared Zod schemas — the single runtime-validation source of truth (spec §29).
 * TypeScript types are inferred from the schemas, never hand-written in parallel.
 * More domain schemas (Patient, LabResult, Intent, MCP tool I/O, RAG) are added in later phases.
 */

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  version: z.string(),
  uptimeSeconds: z.number().nonnegative(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const ReadinessResponseSchema = z.object({
  status: z.enum(['ready', 'not_ready']),
  checks: z.record(z.string(), z.enum(['ok', 'fail'])),
});
export type ReadinessResponse = z.infer<typeof ReadinessResponseSchema>;

export const ChatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  conversationId: z.uuid().optional(),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const ChatResponseSchema = z.object({
  conversationId: z.string(),
  reply: z.string(),
});
export type ChatResponse = z.infer<typeof ChatResponseSchema>;
