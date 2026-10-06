import { describe, it, expect } from 'vitest';
import type { LabResult, Patient, RagSearchResult } from '@carevoice/schemas';
import { Orchestrator, type KnowledgeRetriever } from './orchestrator.js';
import { FakeLlmClient } from './llm/fake-llm.js';
import { createToolRegistry } from '../mcp/tools/index.js';
import { FakeFhirClient, clinicianAuth } from '../mcp/test-support.js';

const patient: Patient = { id: '12724066', name: 'NANCY PATCHTEST', gender: 'female', birthDate: '1990-01-02' };
const labs: LabResult[] = [{ id: 'l1', name: 'Hemoglobin', value: 13.8, unit: 'g/dL', status: 'final', effectiveDate: '2026-10-05' }];
const fhir = new FakeFhirClient({ patients: { '12724066': patient }, labs: { '12724066': labs } });

function buildOrchestrator(options: {
  intent: unknown;
  text?: string;
  rag?: KnowledgeRetriever;
  throwIntent?: boolean;
}): { orchestrator: Orchestrator; llm: FakeLlmClient } {
  const llm = new FakeLlmClient({
    structured: options.intent,
    text: options.text ?? 'Clinical summary.',
    throwStructured: options.throwIntent,
  });
  const orchestrator = new Orchestrator({ llm, registry: createToolRegistry(), fhir, rag: options.rag });
  return { orchestrator, llm };
}

const turn = (message: string, conversationId?: string) => ({
  message,
  conversationId,
  auth: clinicianAuth(),
  requestId: 'req-1',
});

describe('Orchestrator', () => {
  it('fetches labs and summarizes them (patient path)', async () => {
    const { orchestrator, llm } = buildOrchestrator({
      intent: { intent: 'latest_labs', patientId: '12724066' },
      text: 'Hemoglobin 13.8 g/dL.',
    });
    const result = await orchestrator.handleTurn(turn('latest labs for 12724066'));

    expect(result.toolUsed).toEqual({ name: 'get_latest_lab_results', ok: true });
    expect(result.reply).toBe('Hemoglobin 13.8 g/dL.');
    expect(result.patientData).toMatchObject({ patientId: '12724066' });
    // Authoritative EHR data was handed to the model as PATIENT DATA.
    expect(llm.lastText?.prompt).toContain('PATIENT DATA');
    expect(llm.lastText?.prompt).toContain('Hemoglobin');
  });

  it('returns a deterministic message when the patient is not found (no fabrication)', async () => {
    const { orchestrator, llm } = buildOrchestrator({ intent: { intent: 'patient_lookup', patientId: '999' } });
    const result = await orchestrator.handleTurn(turn('find patient 999'));

    expect(result.toolUsed).toEqual({ name: 'get_patient', ok: false });
    expect(result.reply).toContain("couldn't find");
    expect(result.patientData).toBeUndefined();
    expect(llm.lastText).toBeUndefined(); // no generation call on tool failure
  });

  it('asks for a patient ID when one is required but missing', async () => {
    const { orchestrator } = buildOrchestrator({ intent: { intent: 'latest_labs' } });
    const result = await orchestrator.handleTurn(turn('show me the labs'));
    expect(result.reply).toContain('patient ID');
  });

  it('denies access when the caller lacks the required scope', async () => {
    const { orchestrator } = buildOrchestrator({ intent: { intent: 'latest_labs', patientId: '12724066' } });
    const result = await orchestrator.handleTurn({
      ...turn('labs for 12724066'),
      auth: clinicianAuth({ scopes: [] }),
    });
    expect(result.toolUsed?.ok).toBe(false);
    expect(result.reply).toContain('not authorized');
  });

  it('answers a clinical question from retrieved knowledge with citations', async () => {
    const citations: RagSearchResult[] = [
      {
        text: 'Norepinephrine is the first-line vasopressor in septic shock.',
        score: 0.8,
        metadata: { documentId: 'sepsis', documentName: 'Sepsis Protocol', chunkIndex: 1, sourceType: 'guideline' },
      },
    ];
    const rag: KnowledgeRetriever = { search: async () => citations };
    const { orchestrator, llm } = buildOrchestrator({
      intent: { intent: 'clinical_question', query: 'first-line vasopressor in sepsis' },
      text: 'Norepinephrine, per the sepsis protocol.',
      rag,
    });
    const result = await orchestrator.handleTurn(turn('what is the first-line vasopressor in sepsis?'));

    expect(result.citations).toEqual(citations);
    expect(llm.lastText?.prompt).toContain('KNOWLEDGE');
    expect(llm.lastText?.prompt).toContain('Norepinephrine');
  });

  it('degrades gracefully for clinical questions when RAG is unconfigured', async () => {
    const { orchestrator } = buildOrchestrator({ intent: { intent: 'clinical_question', query: 'x' } }); // no rag
    const result = await orchestrator.handleTurn(turn('what is sepsis?'));
    expect(result.reply).toContain('knowledge base is not available');
  });

  it('clarifies on unknown intent and preserves conversationId', async () => {
    const { orchestrator } = buildOrchestrator({ intent: { intent: 'unknown' } });
    const result = await orchestrator.handleTurn(turn('hello there', 'conv-42'));
    expect(result.conversationId).toBe('conv-42');
    expect(result.reply).toContain('rephrase');
  });

  it('returns a retryable service error when intent detection fails (not a clarify)', async () => {
    const { orchestrator } = buildOrchestrator({ intent: {}, throwIntent: true });
    const result = await orchestrator.handleTurn(turn('???'));
    expect(result.error).toBe(true);
    expect(result.reply.toLowerCase()).toContain('busy');
  });
});
