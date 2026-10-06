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

// ── AI intent detection ──────────────────────────────────────────────────────
// Structured output the LLM must produce for a user turn (spec §13). Validated with Zod; the
// orchestrator maps the intent to an MCP tool deterministically (it never lets the LLM name tools).

export const IntentSchema = z.object({
  intent: z.enum([
    'patient_lookup',
    'latest_labs',
    'observations',
    'diagnostic_reports',
    'clinical_question',
    'unknown',
  ]),
  /** Only set when the user explicitly provides a patient id. Never invented. */
  patientId: z.string().optional(),
  /** General knowledge question text, for clinical_question. */
  query: z.string().optional(),
  /** Optional result count the user asked for (e.g. "last 3 labs"). */
  limit: z.number().int().optional(),
});
export type Intent = z.infer<typeof IntentSchema>;

// ── RAG (approved knowledge) ─────────────────────────────────────────────────
// Stable reference content only — never real-time patient data (spec §7). Citations are preserved
// via chunk metadata so answers can point back to the source document (spec §17).

export const RagSourceTypeSchema = z.enum([
  'policy',
  'guideline',
  'reference',
  'documentation',
  'terminology',
  'other',
]);
export type RagSourceType = z.infer<typeof RagSourceTypeSchema>;

export const RagDocumentSchema = z.object({
  documentId: z.string().min(1),
  documentName: z.string().min(1),
  sourceType: RagSourceTypeSchema,
  text: z.string().min(1),
});
export type RagDocument = z.infer<typeof RagDocumentSchema>;

export const RagChunkMetadataSchema = z.object({
  documentId: z.string(),
  documentName: z.string(),
  chunkIndex: z.number().int(),
  sourceType: RagSourceTypeSchema,
  section: z.string().optional(),
  page: z.number().int().optional(),
});
export type RagChunkMetadata = z.infer<typeof RagChunkMetadataSchema>;

export const RagSearchResultSchema = z.object({
  text: z.string(),
  score: z.number(),
  metadata: RagChunkMetadataSchema,
});
export type RagSearchResult = z.infer<typeof RagSearchResultSchema>;
