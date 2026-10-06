import { describe, it, expect } from 'vitest';
import type { ChatStreamEvent, LabResult, Patient } from '@carevoice/schemas';
import { Orchestrator } from './orchestrator.js';
import { FakeLlmClient } from './llm/fake-llm.js';
import { createToolRegistry } from '../mcp/tools/index.js';
import { FakeFhirClient, clinicianAuth } from '../mcp/test-support.js';

const patient: Patient = { id: '12724066', name: 'NANCY PATCHTEST' };
const labs: LabResult[] = [{ id: 'l1', name: 'Hemoglobin', value: 13.8, unit: 'g/dL', status: 'final' }];
const fhir = new FakeFhirClient({ patients: { '12724066': patient }, labs: { '12724066': labs } });

async function collect(intent: unknown, message: string, text = 'Hemoglobin 13.8 g/dL.'): Promise<ChatStreamEvent[]> {
  const llm = new FakeLlmClient({ structured: intent, text });
  const orchestrator = new Orchestrator({ llm, registry: createToolRegistry(), fhir });
  const events: ChatStreamEvent[] = [];
  await orchestrator.streamTurn(
    { message, auth: clinicianAuth(), requestId: 'r1' },
    (event) => events.push(event),
  );
  return events;
}

describe('Orchestrator.streamTurn', () => {
  it('emits intent → tool(running/ok) → patient_data → tokens → done', async () => {
    const events = await collect({ intent: 'latest_labs', patientId: '12724066' }, 'labs for 12724066');
    const types = events.map((e) => e.type);

    expect(types[0]).toBe('intent');
    expect(events.filter((e) => e.type === 'tool').map((e) => e.status)).toEqual(['running', 'ok']);
    expect(events.some((e) => e.type === 'patient_data')).toBe(true);
    expect(events.filter((e) => e.type === 'token').length).toBeGreaterThan(0);
    expect(types.at(-1)).toBe('done');

    const streamed = events.filter((e) => e.type === 'token').map((e) => (e.type === 'token' ? e.text : '')).join('');
    expect(streamed).toBe('Hemoglobin 13.8 g/dL.');
  });

  it('emits a tool error event and a single deterministic token (no fabrication)', async () => {
    const events = await collect({ intent: 'patient_lookup', patientId: '999' }, 'find 999');
    expect(events.some((e) => e.type === 'tool' && e.status === 'error')).toBe(true);
    const tokens = events.filter((e) => e.type === 'token');
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({ type: 'token' });
    expect(events.some((e) => e.type === 'patient_data')).toBe(false);
  });

  it('streams a clarify message for unknown intent', async () => {
    const events = await collect({ intent: 'unknown' }, 'hello');
    expect(events[0]?.type).toBe('intent');
    expect(events.some((e) => e.type === 'token')).toBe(true);
    expect(events.at(-1)?.type).toBe('done');
  });

  it('emits an error event (not a token or done) when the LLM is unavailable', async () => {
    const llm = new FakeLlmClient({ throwStructured: true });
    const orchestrator = new Orchestrator({ llm, registry: createToolRegistry(), fhir });
    const events: ChatStreamEvent[] = [];
    await orchestrator.streamTurn(
      { message: 'find patient named john', auth: clinicianAuth(), requestId: 'r1' },
      (event) => events.push(event),
    );
    expect(events.some((e) => e.type === 'error')).toBe(true);
    expect(events.some((e) => e.type === 'token')).toBe(false);
    expect(events.some((e) => e.type === 'done')).toBe(false);
  });
});
