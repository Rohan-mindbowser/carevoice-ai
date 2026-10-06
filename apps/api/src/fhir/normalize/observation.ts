import type { LabResult } from '@carevoice/schemas';
import type { FhirObservation, FhirReferenceRange, FhirQuantity } from '../fhir-types.js';

function formatQuantity(q: FhirQuantity | undefined): string | undefined {
  if (!q || q.value === undefined) return undefined;
  return q.unit ? `${q.value} ${q.unit}` : `${q.value}`;
}

function formatReferenceRange(range: FhirReferenceRange | undefined): string | undefined {
  if (!range) return undefined;
  if (range.text) return range.text;
  const low = formatQuantity(range.low);
  const high = formatQuantity(range.high);
  if (low && high) return `${low} - ${high}`;
  if (low) return `> ${low}`;
  if (high) return `< ${high}`;
  return undefined;
}

export function normalizeObservation(resource: FhirObservation): LabResult {
  const codeableValue = resource.valueCodeableConcept;
  return {
    id: resource.id ?? '',
    name: resource.code?.text ?? resource.code?.coding?.[0]?.display ?? 'Unknown',
    value: resource.valueQuantity?.value,
    valueText: resource.valueString ?? codeableValue?.text ?? codeableValue?.coding?.[0]?.display,
    unit: resource.valueQuantity?.unit,
    referenceRange: formatReferenceRange(resource.referenceRange?.[0]),
    status: resource.status ?? 'unknown',
    interpretation:
      resource.interpretation?.[0]?.text ?? resource.interpretation?.[0]?.coding?.[0]?.display,
    effectiveDate: resource.effectiveDateTime ?? resource.effectivePeriod?.start,
  };
}

/** Sort newest-first by effective date; undated results sort last. */
export function byEffectiveDateDesc(a: LabResult, b: LabResult): number {
  const ta = a.effectiveDate ? Date.parse(a.effectiveDate) : Number.NEGATIVE_INFINITY;
  const tb = b.effectiveDate ? Date.parse(b.effectiveDate) : Number.NEGATIVE_INFINITY;
  return tb - ta;
}
