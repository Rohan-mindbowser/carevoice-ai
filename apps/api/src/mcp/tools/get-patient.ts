import { z } from 'zod';
import { PatientSchema } from '@carevoice/schemas';
import type { McpTool } from '../tool.js';

const InputSchema = z.object({
  patientId: z.string().min(1),
});

export const getPatientTool: McpTool = {
  name: 'get_patient',
  title: 'Get patient by ID',
  description: 'Retrieve a single patient from the EHR by their exact patient ID.',
  inputSchema: InputSchema,
  inputShape: InputSchema.shape,
  outputSchema: PatientSchema,
  outputShape: PatientSchema.shape,
  requiredScopes: ['patient/Patient.read'],
  execute: async (rawInput, ctx) => {
    const { patientId } = InputSchema.parse(rawInput);
    return ctx.fhir.getPatient(patientId);
  },
};
