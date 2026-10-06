import { AppError } from '../middleware/error-handler.js';

/** Categories of FHIR failure the system handles distinctly (spec §26). */
export type FhirErrorKind =
  | 'not_found'
  | 'unauthorized'
  | 'forbidden'
  | 'timeout'
  | 'unavailable'
  | 'invalid_response';

/**
 * Error raised by the FHIR layer. Carries a machine-readable `kind` plus a client-safe message.
 * The message must never contain PHI or raw FHIR payloads.
 */
export class FhirError extends Error {
  constructor(
    public readonly kind: FhirErrorKind,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'FhirError';
  }
}

const KIND_TO_STATUS: Record<FhirErrorKind, number> = {
  not_found: 404,
  unauthorized: 401,
  forbidden: 403,
  timeout: 504,
  unavailable: 503,
  invalid_response: 502,
};

const KIND_TO_PUBLIC_MESSAGE: Record<FhirErrorKind, string> = {
  not_found: 'The requested patient or record could not be found.',
  unauthorized: 'Not authenticated with the EHR.',
  forbidden: 'Not authorized to access this EHR data.',
  timeout: 'The EHR took too long to respond. Please try again.',
  unavailable: 'The EHR is temporarily unavailable. Please try again.',
  invalid_response: 'The EHR returned an unexpected response.',
};

/** Translate a FHIR error into a transport-level AppError for the HTTP layer (used from Phase 5+). */
export function toAppError(error: FhirError): AppError {
  return new AppError(KIND_TO_STATUS[error.kind], KIND_TO_PUBLIC_MESSAGE[error.kind], {
    cause: error,
  });
}
