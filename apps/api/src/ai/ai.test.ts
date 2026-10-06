import { describe, it, expect } from 'vitest';
import type { Intent } from '@carevoice/schemas';
import { detectIntent } from './intent.js';
import { selectTool } from './tool-selection.js';
import { generateClinicalResponse } from './response.js';
import { FakeLlmClient } from './llm/fake-llm.js';

describe('detectIntent', () => {
  it('returns the validated structured intent', async () => {
    const llm = new FakeLlmClient({ structured: { intent: 'latest_labs', patientId: '12345' } });
    const intent = await detectIntent(llm, 'latest labs for patient 12345');
    expect(intent).toEqual({ intent: 'latest_labs', patientId: '12345' });
  });

  it('throws when the LLM call fails (surfaced as a service error upstream)', async () => {
    const llm = new FakeLlmClient({ throwStructured: true });
    await expect(detectIntent(llm, 'gibberish')).rejects.toThrow();
  });

  it('throws when the LLM returns schema-invalid output', async () => {
    const llm = new FakeLlmClient({ structured: { intent: 'not_a_real_intent' } });
    await expect(detectIntent(llm, 'x')).rejects.toThrow();
  });
});

describe('selectTool', () => {
  const cases: Array<[Intent, { toolName: string; input: Record<string, unknown> } | null]> = [
    [{ intent: 'patient_lookup', patientId: '12345' }, { toolName: 'get_patient', input: { patientId: '12345' } }],
    [{ intent: 'patient_lookup', query: 'nancy' }, { toolName: 'find_patient', input: { name: 'nancy' } }],
    [{ intent: 'latest_labs', patientId: '12345', limit: 3 }, { toolName: 'get_latest_lab_results', input: { patientId: '12345', limit: 3 } }],
    [{ intent: 'observations', patientId: '9' }, { toolName: 'get_observations', input: { patientId: '9' } }],
    [{ intent: 'diagnostic_reports', patientId: '9' }, { toolName: 'get_diagnostic_reports', input: { patientId: '9' } }],
    [{ intent: 'latest_labs' }, null], // missing required patientId
    [{ intent: 'clinical_question', query: 'what is sepsis' }, null],
    [{ intent: 'unknown' }, null],
  ];

  it.each(cases)('maps %o', (intent, expected) => {
    expect(selectTool(intent)).toEqual(expected);
  });
});

describe('generateClinicalResponse', () => {
  it('labels authoritative patient data in the prompt and returns the model text', async () => {
    const llm = new FakeLlmClient({ text: 'Hemoglobin 13.8 g/dL — Normal.' });
    const reply = await generateClinicalResponse(llm, {
      userMessage: 'latest labs?',
      patientData: { results: [{ name: 'Hemoglobin', value: 13.8, unit: 'g/dL' }] },
    });
    expect(reply).toBe('Hemoglobin 13.8 g/dL — Normal.');
    expect(llm.lastText?.prompt).toContain('PATIENT DATA');
    expect(llm.lastText?.prompt).toContain('Hemoglobin');
    expect(llm.lastText?.system).toContain('Never invent');
  });

  it('states when nothing was retrieved', async () => {
    const llm = new FakeLlmClient({ text: 'unavailable' });
    await generateClinicalResponse(llm, { userMessage: 'labs?' });
    expect(llm.lastText?.prompt).toContain('No patient data or approved knowledge');
  });
});
