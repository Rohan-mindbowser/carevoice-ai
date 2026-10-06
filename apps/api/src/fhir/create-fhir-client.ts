import { env } from '../config/env.js';
import type { FHIRClient } from './fhir-client.js';
import { CernerFHIRClient } from './cerner/cerner-client.js';
import { OpenTokenProvider } from './cerner/token-provider.js';

let cached: FHIRClient | undefined;

/**
 * Builds the active FHIR client from config. Centralizing construction here is what makes the
 * EHR vendor swappable (spec §11/§31): callers depend on {@link FHIRClient}, never on Cerner.
 *
 * Auth is open-sandbox by default; the SMART/OAuth token provider is wired in Phase 12 and will be
 * selected here when secure Cerner credentials are present.
 */
export function createFhirClient(): FHIRClient {
  switch (env.FHIR_SOURCE) {
    case 'cerner':
      return new CernerFHIRClient({
        baseUrl: env.CERNER_BASE_URL,
        timeoutMs: env.FHIR_TIMEOUT_MS,
        tokenProvider: new OpenTokenProvider(),
      });
  }
}

/** Process-wide singleton so connection reuse and (later) token caching are shared. */
export function getFhirClient(): FHIRClient {
  cached ??= createFhirClient();
  return cached;
}
