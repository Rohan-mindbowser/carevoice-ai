import { z } from 'zod';
import { PatientSchema } from '@carevoice/schemas';
import type { McpTool } from '../tool.js';

// Base object drives the raw shape (for JSON Schema / MCP); the refinement enforces "at least one
// search field" at validation time. Kept separate because `.refine()` returns a non-object schema
// that has no `.shape`.
const InputObject = z.object({
  name: z.string().min(1).optional(),
  family: z.string().min(1).optional(),
  given: z.string().min(1).optional(),
  birthDate: z.string().min(1).optional(),
  identifier: z.string().min(1).optional(),
});

const InputSchema = InputObject.refine(
  (value) => Object.values(value).some((field) => field !== undefined),
  { message: 'Provide at least one search field (name, family, given, birthDate, or identifier)' },
);

const OutputSchema = z.object({
  patients: z.array(PatientSchema),
});

export const findPatientTool: McpTool = {
  name: 'find_patient',
  title: 'Find patients by demographics',
  description:
    'Search the EHR for patients by name, date of birth, or identifier. Use get_patient when the exact patient ID is already known.',
  inputSchema: InputSchema,
  inputShape: InputObject.shape,
  outputSchema: OutputSchema,
  outputShape: OutputSchema.shape,
  requiredScopes: ['patient/Patient.read'],
  execute: async (rawInput, ctx) => {
    const input = InputSchema.parse(rawInput);
    const patients = await ctx.fhir.searchPatients(input);
    return { patients };
  },
};
