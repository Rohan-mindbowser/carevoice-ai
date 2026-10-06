import type { DiagnosticReportSummary } from '@carevoice/schemas';
import type { FhirDiagnosticReport } from '../fhir-types.js';

export function normalizeDiagnosticReport(resource: FhirDiagnosticReport): DiagnosticReportSummary {
  return {
    id: resource.id ?? '',
    name: resource.code?.text ?? resource.code?.coding?.[0]?.display ?? 'Diagnostic Report',
    status: resource.status ?? 'unknown',
    category: resource.category?.[0]?.text ?? resource.category?.[0]?.coding?.[0]?.display,
    effectiveDate: resource.effectiveDateTime,
    conclusion: resource.conclusion,
  };
}
