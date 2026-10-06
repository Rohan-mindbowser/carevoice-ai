import { ToolRegistry } from '../registry.js';
import type { McpTool } from '../tool.js';
import { findPatientTool } from './find-patient.js';
import { getPatientTool } from './get-patient.js';
import { getLatestLabResultsTool } from './get-latest-lab-results.js';
import { getObservationsTool } from './get-observations.js';
import { getDiagnosticReportsTool } from './get-diagnostic-reports.js';

/** All healthcare tools CareVoice AI exposes (read-only in v1, spec §20). */
export const allTools: McpTool[] = [
  findPatientTool,
  getPatientTool,
  getLatestLabResultsTool,
  getObservationsTool,
  getDiagnosticReportsTool,
];

export function createToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  for (const tool of allTools) {
    registry.register(tool);
  }
  return registry;
}
