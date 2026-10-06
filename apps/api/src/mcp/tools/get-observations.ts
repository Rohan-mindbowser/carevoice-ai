import { z } from 'zod';
import { LabResultSchema } from '@carevoice/schemas';
import type { McpTool } from '../tool.js';

const InputSchema = z.object({
  patientId: z.string().min(1),
  category: z.enum(['laboratory', 'vital-signs']).default('laboratory'),
  limit: z.number().int().min(1).max(50).default(20),
});

const OutputSchema = z.object({
  patientId: z.string(),
  category: z.string(),
  observations: z.array(LabResultSchema),
});

export const getObservationsTool: McpTool = {
  name: 'get_observations',
  title: 'Get observations',
  description:
    'Retrieve a patient\'s observations from the EHR by category (laboratory or vital-signs).',
  inputSchema: InputSchema,
  inputShape: InputSchema.shape,
  outputSchema: OutputSchema,
  outputShape: OutputSchema.shape,
  requiredScopes: ['patient/Observation.read'],
  execute: async (rawInput, ctx) => {
    const { patientId, category, limit } = InputSchema.parse(rawInput);
    const observations = await ctx.fhir.getObservations(patientId, { category, limit });
    return { patientId, category, observations };
  },
};
