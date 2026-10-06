import type { DiagnosticReportSummary, LabResult, Patient } from '@carevoice/schemas';
import type { FHIRClient, ObservationQuery, PatientSearchQuery } from '../fhir/fhir-client.js';
import type { AuthContext } from '../security/authorization.js';
import type { ToolContext } from './tool.js';
import { FhirError } from '../fhir/errors.js';

/** In-memory FHIR client for tests — no network. Not a production MockFHIRClient (none exists). */
export class FakeFhirClient implements FHIRClient {
  constructor(
    private readonly data: {
      patients?: Record<string, Patient>;
      labs?: Record<string, LabResult[]>;
      reports?: Record<string, DiagnosticReportSummary[]>;
    } = {},
  ) {}

  async getPatient(patientId: string): Promise<Patient> {
    const patient = this.data.patients?.[patientId];
    if (!patient) {
      throw new FhirError('not_found', 'patient not found');
    }
    return patient;
  }

  async searchPatients(query: PatientSearchQuery): Promise<Patient[]> {
    const all = Object.values(this.data.patients ?? {});
    const needle = query.name?.toLowerCase();
    if (!needle) return all;
    return all.filter((p) => p.name.toLowerCase().includes(needle));
  }

  async getObservations(patientId: string, _options?: ObservationQuery): Promise<LabResult[]> {
    return this.data.labs?.[patientId] ?? [];
  }

  async getLatestLabResults(patientId: string, limit = 5): Promise<LabResult[]> {
    return (this.data.labs?.[patientId] ?? []).slice(0, limit);
  }

  async getDiagnosticReports(patientId: string): Promise<DiagnosticReportSummary[]> {
    return this.data.reports?.[patientId] ?? [];
  }
}

export function clinicianAuth(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: 'u1',
    tenantId: 't1',
    roles: ['clinician'],
    scopes: ['patient/*.read'],
    ...overrides,
  };
}

export function toolContext(fhir: FHIRClient, auth: AuthContext): ToolContext {
  return { fhir, auth, requestId: 'req-test' };
}
