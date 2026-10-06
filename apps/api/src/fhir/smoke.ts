/**
 * Manual smoke test against the live FHIR sandbox. Not part of the automated suite.
 *   pnpm --filter @carevoice/api fhir:smoke [patientId]
 * Prints a normalized patient + latest labs so you can eyeball real EHR data end-to-end.
 */
import { getFhirClient } from './create-fhir-client.js';

async function main(): Promise<void> {
  const patientId = process.argv[2] ?? '12724066';
  const client = getFhirClient();

  const patient = await client.getPatient(patientId);
  console.log('Patient:', patient);

  const labs = await client.getLatestLabResults(patientId, 5);
  console.log(`Latest ${labs.length} labs:`);
  for (const lab of labs) {
    const value =
      lab.value !== undefined
        ? `${lab.value}${lab.unit ? ` ${lab.unit}` : ''}`
        : (lab.valueText ?? '—');
    console.log(`  • ${lab.name}: ${value} [${lab.status}] ${lab.effectiveDate ?? ''}`);
  }
}

main().catch((error: unknown) => {
  console.error('FHIR smoke test failed:', error);
  process.exit(1);
});
