import type { DiagnosticReportSummary, LabResult, Patient } from '@carevoice/schemas';

export interface PatientSearchQuery {
  /** Free-text name search (maps to FHIR `name`). */
  name?: string;
  family?: string;
  given?: string;
  /** YYYY-MM-DD (maps to FHIR `birthdate`). */
  birthDate?: string;
  /** System|value or bare value (maps to FHIR `identifier`). */
  identifier?: string;
}

export interface ObservationQuery {
  category?: 'laboratory' | 'vital-signs';
  /** Upper bound on results (maps to FHIR `_count`, clamped by the adapter). */
  limit?: number;
}

/**
 * Vendor-neutral EHR interface (spec §11/§31). The AI/MCP layers depend only on this; concrete
 * adapters (Cerner today, Epic/others later) stay behind it so vendor swaps don't touch the AI
 * orchestration. Methods return normalized domain models, never raw FHIR.
 */
export interface FHIRClient {
  getPatient(patientId: string): Promise<Patient>;
  searchPatients(query: PatientSearchQuery): Promise<Patient[]>;
  getObservations(patientId: string, options?: ObservationQuery): Promise<LabResult[]>;
  getLatestLabResults(patientId: string, limit?: number): Promise<LabResult[]>;
  getDiagnosticReports(patientId: string): Promise<DiagnosticReportSummary[]>;
}
