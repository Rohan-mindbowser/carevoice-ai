import { z } from 'zod';
import { LabResultSchema } from '@carevoice/schemas';
import type { McpTool } from '../tool.js';

const InputSchema = z.object({
  patientId: z.string().min(1),
  limit: z.number().int().min(1).max(20).default(5),
});

const OutputSchema = z.object({
  patientId: z.string(),
  results: z.array(LabResultSchema),
});

export const getLatestLabResultsTool: McpTool = {
  name: 'get_latest_lab_results',
  title: 'Get latest lab results',
  description:
    "Retrieve a patient's most recent laboratory results from the EHR, newest first. Returns actual EHR values only.",
  inputSchema: InputSchema,
  inputShape: InputSchema.shape,
  outputSchema: OutputSchema,
  outputShape: OutputSchema.shape,
  requiredScopes: ['patient/Observation.read'],
  execute: async (rawInput, ctx) => {
    const { patientId, limit } = InputSchema.parse(rawInput);
    const results = await ctx.fhir.getLatestLabResults(patientId, limit);
    return { patientId, results };
  },
};
