import type { LlmClient } from './llm/llm-client.js';
import { CLINICAL_RESPONSE_PROMPT } from './prompts/clinical-response.js';

export interface ClinicalResponseInput {
  userMessage: string;
  /** Normalized facts retrieved from tools (EHR). Authoritative — the model must not alter them. */
  patientData?: unknown;
  /** Approved reference context from RAG (wired in Phase 7). */
  knowledge?: string;
}

/**
 * Generate the final clinician-facing answer from retrieved facts. The prompt clearly separates
 * authoritative PATIENT DATA from general KNOWLEDGE, and the system prompt forbids fabrication, so
 * the LLM can only summarize what it was given (spec §6/§15/§39).
 */
/** Build the system+prompt pair for a clinical answer. Shared by the streaming and non-streaming paths. */
export function buildClinicalPrompt(input: ClinicalResponseInput): { system: string; prompt: string } {
  const sections: string[] = [];

  if (input.patientData !== undefined) {
    sections.push(
      `PATIENT DATA (authoritative, retrieved from the EHR — report exactly, do not alter values or dates):\n${JSON.stringify(input.patientData, null, 2)}`,
    );
  }
  if (input.knowledge) {
    sections.push(`KNOWLEDGE (approved reference material):\n${input.knowledge}`);
  }
  if (sections.length === 0) {
    sections.push('No patient data or approved knowledge was retrieved for this request.');
  }

  const prompt = `${sections.join('\n\n')}\n\nClinician request: ${input.userMessage}`;
  return { system: CLINICAL_RESPONSE_PROMPT.system, prompt };
}

export async function generateClinicalResponse(
  llm: LlmClient,
  input: ClinicalResponseInput,
): Promise<string> {
  const { system, prompt } = buildClinicalPrompt(input);
  return llm.generateText({ system, prompt });
}
