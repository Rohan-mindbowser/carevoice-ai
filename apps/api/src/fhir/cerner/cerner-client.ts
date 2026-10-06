import type { DiagnosticReportSummary, LabResult, Patient } from '@carevoice/schemas';
import type {
  FHIRClient,
  ObservationQuery,
  PatientSearchQuery,
} from '../fhir-client.js';
import type {
  FhirBundle,
  FhirDiagnosticReport,
  FhirObservation,
  FhirOperationOutcome,
  FhirPatient,
} from '../fhir-types.js';
import type { TokenProvider } from './token-provider.js';
import { FhirError } from '../errors.js';
import { fetchFhirJson } from '../http.js';
import { normalizePatient } from '../normalize/patient.js';
import { byEffectiveDateDesc, normalizeObservation } from '../normalize/observation.js';
import { normalizeDiagnosticReport } from '../normalize/diagnostic-report.js';

export interface CernerClientConfig {
  /** FHIR R4 base URL (open or secure Cerner endpoint). */
  baseUrl: string;
  timeoutMs: number;
  tokenProvider: TokenProvider;
}

/** FHIR `_count` is clamped so the AI layer can never trigger an unbounded fetch (spec §23). */
const MAX_COUNT = 50;
function clampCount(limit: number): number {
  if (!Number.isFinite(limit)) return 1;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_COUNT);
}

function bundleResources<T>(bundle: FhirBundle<T>): T[] {
  return (bundle.entry ?? [])
    .map((entry) => entry.resource)
    .filter((resource): resource is T => resource !== undefined);
}

/**
 * Cerner / Oracle Health FHIR R4 adapter. All vendor specifics (base URL, auth header, query
 * parameter conventions) live here; everything above it speaks the vendor-neutral {@link FHIRClient}.
 */
export class CernerFHIRClient implements FHIRClient {
  constructor(private readonly config: CernerClientConfig) {}

  private async request<T>(path: string): Promise<T> {
    const token = await this.config.tokenProvider.getAccessToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return fetchFhirJson<T>(`${this.config.baseUrl}${path}`, {
      timeoutMs: this.config.timeoutMs,
      headers,
    });
  }

  async getPatient(patientId: string): Promise<Patient> {
    const resource = await this.request<FhirPatient | FhirOperationOutcome>(
      `/Patient/${encodeURIComponent(patientId)}`,
    );
    if (resource.resourceType !== 'Patient') {
      throw new FhirError('invalid_response', 'Expected a Patient resource from FHIR');
    }
    return normalizePatient(resource);
  }

  async searchPatients(query: PatientSearchQuery): Promise<Patient[]> {
    const params = new URLSearchParams();
    if (query.name) params.set('name', query.name);
    if (query.family) params.set('family', query.family);
    if (query.given) params.set('given', query.given);
    if (query.birthDate) params.set('birthdate', query.birthDate);
    if (query.identifier) params.set('identifier', query.identifier);
    params.set('_count', '10');

    const bundle = await this.request<FhirBundle<FhirPatient>>(`/Patient?${params.toString()}`);
    return bundleResources(bundle).map(normalizePatient);
  }

  async getObservations(patientId: string, options?: ObservationQuery): Promise<LabResult[]> {
    const params = new URLSearchParams();
    params.set('patient', patientId);
    params.set('category', options?.category ?? 'laboratory');
    params.set('_count', String(clampCount(options?.limit ?? 20)));

    const bundle = await this.request<FhirBundle<FhirObservation>>(
      `/Observation?${params.toString()}`,
    );
    return bundleResources(bundle).map(normalizeObservation);
  }

  async getLatestLabResults(patientId: string, limit = 5): Promise<LabResult[]> {
    const count = clampCount(limit);
    const observations = await this.getObservations(patientId, {
      category: 'laboratory',
      limit: count,
    });
    // Cerner tends to return newest-first, but sort defensively before slicing to `limit`.
    return [...observations].sort(byEffectiveDateDesc).slice(0, count);
  }

  async getDiagnosticReports(patientId: string): Promise<DiagnosticReportSummary[]> {
    const params = new URLSearchParams();
    params.set('patient', patientId);
    params.set('_count', '20');

    const bundle = await this.request<FhirBundle<FhirDiagnosticReport>>(
      `/DiagnosticReport?${params.toString()}`,
    );
    return bundleResources(bundle).map(normalizeDiagnosticReport);
  }
}
