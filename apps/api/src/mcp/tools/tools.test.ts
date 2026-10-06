import { describe, it, expect } from 'vitest';
import type { LabResult, Patient } from '@carevoice/schemas';
import { executeTool } from '../executor.js';
import { createToolRegistry } from './index.js';
import { getPatientTool } from './get-patient.js';
import { getLatestLabResultsTool } from './get-latest-lab-results.js';
import { findPatientTool } from './find-patient.js';
import { toFunctionDeclaration } from '../llm-schema.js';
import { FakeFhirClient, clinicianAuth, toolContext } from '../test-support.js';

const patient: Patient = {
  id: '12724066',
  name: 'NANCY PATCHTEST',
  gender: 'female',
  birthDate: '1990-01-02',
};

const labs: LabResult[] = [
  { id: 'l1', name: 'Hemoglobin', value: 13.8, unit: 'g/dL', status: 'final', effectiveDate: '2026-10-05' },
  { id: 'l2', name: 'WBC', value: 7.2, unit: 'K/uL', status: 'final', effectiveDate: '2026-10-05' },
];

const fhir = new FakeFhirClient({
  patients: { '12724066': patient },
  labs: { '12724066': labs },
});
const ctx = toolContext(fhir, clinicianAuth());

describe('get_patient tool', () => {
  it('returns a normalized patient', async () => {
    const result = await executeTool(getPatientTool, { patientId: '12724066' }, ctx);
    expect(result).toEqual({ ok: true, data: patient });
  });

  it('surfaces not_found for an unknown id', async () => {
    const result = await executeTool(getPatientTool, { patientId: '999' }, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('not_found');
  });

  it('rejects a missing patientId', async () => {
    const result = await executeTool(getPatientTool, {}, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('invalid_input');
  });
});

describe('get_latest_lab_results tool', () => {
  it('applies the default limit and returns results', async () => {
    const result = await executeTool(getLatestLabResultsTool, { patientId: '12724066' }, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { patientId: string; results: LabResult[] };
      expect(data.patientId).toBe('12724066');
      expect(data.results).toHaveLength(2);
    }
  });

  it('rejects an out-of-range limit from the LLM', async () => {
    const result = await executeTool(getLatestLabResultsTool, { patientId: '12724066', limit: 999 }, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('invalid_input');
  });
});

describe('find_patient tool', () => {
  it('requires at least one search field', async () => {
    const result = await executeTool(findPatientTool, {}, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('invalid_input');
  });

  it('searches by name', async () => {
    const result = await executeTool(findPatientTool, { name: 'nancy' }, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { patients: Patient[] };
      expect(data.patients).toHaveLength(1);
      expect(data.patients[0]?.id).toBe('12724066');
    }
  });
});

describe('registry + LLM schema', () => {
  it('registers all five tools', () => {
    expect(createToolRegistry().list().map((t) => t.name).sort()).toEqual([
      'find_patient',
      'get_diagnostic_reports',
      'get_latest_lab_results',
      'get_observations',
      'get_patient',
    ]);
  });

  it('generates a JSON Schema function declaration for the LLM', () => {
    const decl = toFunctionDeclaration(getLatestLabResultsTool);
    expect(decl.name).toBe('get_latest_lab_results');
    expect(decl.parameters).toMatchObject({ type: 'object' });
    const props = (decl.parameters as { properties?: Record<string, unknown> }).properties ?? {};
    expect(Object.keys(props)).toContain('patientId');
    expect(Object.keys(props)).toContain('limit');
  });
});
