import { describe, it, expect } from 'vitest';
import { PatientSchema, LabResultSchema } from '@carevoice/schemas';
import { normalizePatient } from './patient.js';
import { normalizeObservation, byEffectiveDateDesc } from './observation.js';
import type { FhirObservation, FhirPatient } from '../fhir-types.js';

describe('normalizePatient', () => {
  it('prefers the official name and outputs a schema-valid Patient', () => {
    // Mirrors the Cerner sandbox shape: many historical names, official one current.
    const resource: FhirPatient = {
      resourceType: 'Patient',
      id: '12724066',
      gender: 'female',
      birthDate: '1990-01-02',
      name: [
        { use: 'old', text: 'SMART, NANCY', family: 'SMART', given: ['NANCY'] },
        { use: 'official', family: 'PATCHTEST', given: ['NANCY'] },
      ],
      identifier: [{ type: { coding: [{ code: 'MR' }] }, value: 'MRN-001' }],
    };

    const patient = normalizePatient(resource);

    expect(patient.name).toBe('NANCY PATCHTEST');
    expect(patient.id).toBe('12724066');
    expect(patient.mrn).toBe('MRN-001');
    expect(() => PatientSchema.parse(patient)).not.toThrow();
  });

  it('falls back to Unknown when no name is present', () => {
    expect(normalizePatient({ resourceType: 'Patient', id: 'x' }).name).toBe('Unknown');
  });
});

describe('normalizeObservation', () => {
  it('maps a numeric lab with units, status, interpretation and reference range', () => {
    const resource: FhirObservation = {
      resourceType: 'Observation',
      id: 'obs-1',
      status: 'final',
      code: { text: 'Hemoglobin' },
      valueQuantity: { value: 13.8, unit: 'g/dL' },
      interpretation: [{ text: 'Normal' }],
      referenceRange: [{ low: { value: 12, unit: 'g/dL' }, high: { value: 16, unit: 'g/dL' } }],
      effectiveDateTime: '2026-10-05T09:00:00.000Z',
    };

    const lab = normalizeObservation(resource);

    expect(lab).toMatchObject({
      name: 'Hemoglobin',
      value: 13.8,
      unit: 'g/dL',
      status: 'final',
      interpretation: 'Normal',
      referenceRange: '12 g/dL - 16 g/dL',
      effectiveDate: '2026-10-05T09:00:00.000Z',
    });
    expect(() => LabResultSchema.parse(lab)).not.toThrow();
  });

  it('captures non-numeric results as valueText', () => {
    const lab = normalizeObservation({
      resourceType: 'Observation',
      id: 'obs-2',
      status: 'final',
      code: { coding: [{ display: 'COVID-19 PCR' }] },
      valueCodeableConcept: { text: 'POSITIVE' },
    });

    expect(lab.name).toBe('COVID-19 PCR');
    expect(lab.value).toBeUndefined();
    expect(lab.valueText).toBe('POSITIVE');
  });
});

describe('byEffectiveDateDesc', () => {
  it('sorts newest first and pushes undated results to the end', () => {
    const base = { id: '', name: '', status: 'final' } as const;
    const sorted = [
      { ...base, effectiveDate: '2026-01-01' },
      { ...base, effectiveDate: undefined },
      { ...base, effectiveDate: '2026-10-01' },
    ].sort(byEffectiveDateDesc);

    expect(sorted.map((l) => l.effectiveDate)).toEqual(['2026-10-01', '2026-01-01', undefined]);
  });
});
