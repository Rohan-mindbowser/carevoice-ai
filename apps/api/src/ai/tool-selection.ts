import type { Intent } from '@carevoice/schemas';

export interface ToolPlan {
  toolName: string;
  input: Record<string, unknown>;
}

/**
 * Deterministically map a detected intent to the MCP tool to run (spec §15 tool selection).
 * Deliberately NOT done by the LLM: the model classifies intent, but we choose the tool and build
 * its arguments, so the AI can never invoke an arbitrary capability. Returns null when no patient
 * tool applies (general knowledge / unknown / missing required parameters).
 */
export function selectTool(intent: Intent): ToolPlan | null {
  switch (intent.intent) {
    case 'patient_lookup':
      if (intent.patientId) return { toolName: 'get_patient', input: { patientId: intent.patientId } };
      if (intent.query) return { toolName: 'find_patient', input: { name: intent.query } };
      return null;
    case 'latest_labs':
      if (!intent.patientId) return null;
      return {
        toolName: 'get_latest_lab_results',
        input: { patientId: intent.patientId, ...(intent.limit ? { limit: intent.limit } : {}) },
      };
    case 'observations':
      if (!intent.patientId) return null;
      return { toolName: 'get_observations', input: { patientId: intent.patientId } };
    case 'diagnostic_reports':
      if (!intent.patientId) return null;
      return { toolName: 'get_diagnostic_reports', input: { patientId: intent.patientId } };
    case 'clinical_question':
    case 'unknown':
      return null;
  }
}
