import { z } from 'zod';
import { DiagnosticReportSummarySchema } from '@carevoice/schemas';
import type { McpTool } from '../tool.js';

const InputSchema = z.object({
  patientId: z.string().min(1),
});

const OutputSchema = z.object({
  patientId: z.string(),
  reports: z.array(DiagnosticReportSummarySchema),
});

export const getDiagnosticReportsTool: McpTool = {
  name: 'get_diagnostic_reports',
  title: 'Get diagnostic reports',
  description: "Retrieve a patient's diagnostic reports (e.g. labs panels, imaging) from the EHR.",
  inputSchema: InputSchema,
  inputShape: InputSchema.shape,
  outputSchema: OutputSchema,
  outputShape: OutputSchema.shape,
  requiredScopes: ['patient/DiagnosticReport.read'],
  execute: async (rawInput, ctx) => {
    const { patientId } = InputSchema.parse(rawInput);
    const reports = await ctx.fhir.getDiagnosticReports(patientId);
    return { patientId, reports };
  },
};
