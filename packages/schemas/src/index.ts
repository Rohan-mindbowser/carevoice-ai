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

// ── Normalized FHIR domain models ────────────────────────────────────────────
// Compact shapes the rest of the system (MCP, AI context, UI) consumes instead of
// raw FHIR JSON (spec §12). Lower tokens, less vendor coupling, easier to test.

export const PatientSchema = z.object({
  id: z.string(),
  /** Display name — PHI. Safe to show to an authorized clinician; never log it. */
  name: z.string(),
  gender: z.string().optional(),
  birthDate: z.string().optional(),
  /** Medical record number, when present on the FHIR resource. */
  mrn: z.string().optional(),
});
export type Patient = z.infer<typeof PatientSchema>;

export const LabResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Numeric result value when the observation is a quantity. */
  value: z.number().optional(),
  /** Non-numeric result (e.g. "POSITIVE") when there is no quantity. */
  valueText: z.string().optional(),
  unit: z.string().optional(),
  referenceRange: z.string().optional(),
  status: z.string(),
  interpretation: z.string().optional(),
  effectiveDate: z.string().optional(),
});
export type LabResult = z.infer<typeof LabResultSchema>;

export const DiagnosticReportSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  category: z.string().optional(),
  effectiveDate: z.string().optional(),
  conclusion: z.string().optional(),
});
export type DiagnosticReportSummary = z.infer<typeof DiagnosticReportSummarySchema>;
