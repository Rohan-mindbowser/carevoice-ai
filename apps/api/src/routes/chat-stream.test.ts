import { describe, it, expect } from 'vitest';
import request from 'supertest';
import type { ChatStreamEvent, LabResult, Patient } from '@carevoice/schemas';
import { createApp } from '../app.js';
import { Orchestrator } from '../ai/orchestrator.js';
import { FakeLlmClient } from '../ai/llm/fake-llm.js';
import { createToolRegistry } from '../mcp/tools/index.js';
import { FakeFhirClient } from '../mcp/test-support.js';

const patient: Patient = { id: '12724066', name: 'NANCY PATCHTEST' };
const labs: LabResult[] = [{ id: 'l1', name: 'Hemoglobin', value: 13.8, unit: 'g/dL', status: 'final' }];
const fhir = new FakeFhirClient({ patients: { '12724066': patient }, labs: { '12724066': labs } });

function appWithFakes() {
  const llm = new FakeLlmClient({ structured: { intent: 'latest_labs', patientId: '12724066' }, text: 'Hemoglobin 13.8 g/dL.' });
  const orchestrator = new Orchestrator({ llm, registry: createToolRegistry(), fhir });
  return createApp({ resolveOrchestrator: () => orchestrator });
}

/** Parse an SSE body into typed events. */
function parseSse(body: string): ChatStreamEvent[] {
  return body
    .split('\n\n')
    .map((block) => block.replace(/^data: /, '').trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as ChatStreamEvent);
}

describe('POST /api/v1/chat/stream (SSE)', () => {
  it('streams intent, tool status, patient data, tokens, and done', async () => {
    const res = await request(appWithFakes())
      .post('/api/v1/chat/stream')
      .send({ message: 'latest labs for patient 12724066' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');

    const events = parseSse(res.text);
    const types = events.map((e) => e.type);
    expect(types).toContain('intent');
    expect(types).toContain('patient_data');
    expect(types).toContain('token');
    expect(types.at(-1)).toBe('done');

    const reply = events.filter((e) => e.type === 'token').map((e) => (e.type === 'token' ? e.text : '')).join('');
    expect(reply).toBe('Hemoglobin 13.8 g/dL.');
  });

  it('rejects an empty message with 400 (before opening the stream)', async () => {
    const res = await request(appWithFakes()).post('/api/v1/chat/stream').send({ message: '' });
    expect(res.status).toBe(400);
  });
});
