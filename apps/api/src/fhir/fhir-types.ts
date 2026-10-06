/**
 * Minimal FHIR R4 shapes — only the fields we actually read before normalizing.
 * Hand-rolled (rather than pulling @types/fhir) because we consume a small, stable subset and
 * want zero dependency surface here (spec §38). Normalization (spec §12) is the real contract.
 */

export interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
}

export interface FhirCodeableConcept {
  text?: string;
  coding?: FhirCoding[];
}

export interface FhirHumanName {
  use?: string;
  text?: string;
  family?: string;
  given?: string[];
  suffix?: string[];
}

export interface FhirIdentifier {
  use?: string;
  type?: FhirCodeableConcept;
  system?: string;
  value?: string;
}

export interface FhirQuantity {
  value?: number;
  unit?: string;
}

export interface FhirReferenceRange {
  low?: FhirQuantity;
  high?: FhirQuantity;
  text?: string;
}

export interface FhirPatient {
  resourceType: 'Patient';
  id?: string;
  name?: FhirHumanName[];
  gender?: string;
  birthDate?: string;
  identifier?: FhirIdentifier[];
}

export interface FhirObservation {
  resourceType: 'Observation';
  id?: string;
  status?: string;
  code?: FhirCodeableConcept;
  valueQuantity?: FhirQuantity;
  valueString?: string;
  valueCodeableConcept?: FhirCodeableConcept;
  interpretation?: FhirCodeableConcept[];
  referenceRange?: FhirReferenceRange[];
  effectiveDateTime?: string;
  effectivePeriod?: { start?: string; end?: string };
}

export interface FhirDiagnosticReport {
  resourceType: 'DiagnosticReport';
  id?: string;
  status?: string;
  code?: FhirCodeableConcept;
  category?: FhirCodeableConcept[];
  effectiveDateTime?: string;
  conclusion?: string;
}

export interface FhirBundleEntry<T> {
  fullUrl?: string;
  resource?: T;
}

export interface FhirBundle<T> {
  resourceType: 'Bundle';
  type?: string;
  total?: number;
  link?: Array<{ relation: string; url: string }>;
  entry?: Array<FhirBundleEntry<T>>;
}

export interface FhirOperationOutcome {
  resourceType: 'OperationOutcome';
  issue?: Array<{ severity?: string; code?: string; diagnostics?: string }>;
}
