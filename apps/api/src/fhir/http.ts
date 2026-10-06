import { FhirError } from './errors.js';

interface FetchFhirOptions {
  timeoutMs: number;
  headers?: Record<string, string>;
  /** Retries on transient failures (network error, timeout, 429, 5xx). Default 2. */
  retries?: number;
}

const RETRY_BASE_DELAY_MS = 200;

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * GET a FHIR resource as JSON with a per-attempt timeout and exponential backoff on transient
 * failures (spec §23). All FHIR reads are idempotent GETs, so retrying is safe. Node's global
 * fetch reuses connections via the shared keep-alive dispatcher, giving us connection reuse for
 * free; a dedicated undici pool can be introduced later if finer control is needed.
 *
 * Errors are normalized to {@link FhirError} — callers never see raw HTTP/network detail.
 */
export async function fetchFhirJson<T>(url: string, options: FetchFhirOptions): Promise<T> {
  const retries = options.retries ?? 2;

  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/fhir+json', ...options.headers },
        // Fresh timeout per attempt so a retry isn't starved by a previous slow call.
        signal: AbortSignal.timeout(options.timeoutMs),
      });

      if (response.status === 404) {
        throw new FhirError('not_found', 'FHIR resource not found');
      }
      if (response.status === 401) {
        throw new FhirError('unauthorized', 'FHIR authentication failed');
      }
      if (response.status === 403) {
        throw new FhirError('forbidden', 'FHIR authorization failed');
      }
      if (response.status === 429 || response.status >= 500) {
        if (attempt < retries) {
          await delay(RETRY_BASE_DELAY_MS * 2 ** attempt);
          continue;
        }
        throw new FhirError('unavailable', `FHIR service unavailable (status ${response.status})`);
      }
      if (!response.ok) {
        throw new FhirError('invalid_response', `Unexpected FHIR status ${response.status}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      // Decided, non-retryable FHIR errors propagate immediately.
      if (error instanceof FhirError) {
        throw error;
      }
      // Network error or timeout — retry, then give up with a typed error.
      if (attempt < retries) {
        await delay(RETRY_BASE_DELAY_MS * 2 ** attempt);
        continue;
      }
      if (isTimeout(error)) {
        throw new FhirError('timeout', 'FHIR request timed out', { cause: error });
      }
      throw new FhirError('unavailable', 'FHIR request failed', { cause: error });
    }
  }
}
