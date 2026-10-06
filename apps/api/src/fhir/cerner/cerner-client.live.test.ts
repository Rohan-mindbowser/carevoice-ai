import { describe, it, expect } from 'vitest';
import { CernerFHIRClient } from './cerner-client.js';
import { OpenTokenProvider } from './token-provider.js';
import { CERNER_OPEN_SANDBOX_URL } from '../../config/env.js';

/**
 * Live integration test against Cerner's OPEN FHIR sandbox. Network-gated so the normal suite stays
 * hermetic (spec §33): run with `FHIR_LIVE=1 pnpm --filter @carevoice/api test`.
 */
const LIVE = process.env.FHIR_LIVE === '1';
const SANDBOX_PATIENT_ID = '12724066';

describe.skipIf(!LIVE)('CernerFHIRClient (live open sandbox)', () => {
  const client = new CernerFHIRClient({
    baseUrl: CERNER_OPEN_SANDBOX_URL,
    timeoutMs: 15_000,
    tokenProvider: new OpenTokenProvider(),
  });

  it('fetches and normalizes a real patient', async () => {
    const patient = await client.getPatient(SANDBOX_PATIENT_ID);
    expect(patient.id).toBe(SANDBOX_PATIENT_ID);
    expect(patient.name.length).toBeGreaterThan(0);
  });

  it('fetches latest lab results sorted newest-first', async () => {
    const labs = await client.getLatestLabResults(SANDBOX_PATIENT_ID, 5);
    expect(labs.length).toBeGreaterThan(0);
    expect(labs.length).toBeLessThanOrEqual(5);
    for (const lab of labs) {
      expect(lab.name.length).toBeGreaterThan(0);
      expect(lab.status.length).toBeGreaterThan(0);
    }
  });

  it('rejects an unknown patient with a typed not_found error', async () => {
    await expect(client.getPatient('does-not-exist-00000')).rejects.toMatchObject({
      name: 'FhirError',
      kind: 'not_found',
    });
  });
});
