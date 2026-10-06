import { describe, it, expect } from 'vitest';
import request from 'supertest';
import type { LabResult, Patient } from '@carevoice/schemas';
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

describe('POST /api/v1/chat', () => {
  it('returns a reply, intent, and patient data', async () => {
    const res = await request(appWithFakes())
      .post('/api/v1/chat')
      .send({ message: 'latest labs for patient 12724066' });

    expect(res.status).toBe(200);
    expect(res.body.reply).toBe('Hemoglobin 13.8 g/dL.');
    expect(res.body.intent.intent).toBe('latest_labs');
    expect(res.body.toolUsed).toEqual({ name: 'get_latest_lab_results', ok: true });
    expect(res.body.patientData.patientId).toBe('12724066');
    expect(typeof res.body.conversationId).toBe('string');
  });

  it('rejects an empty message with 400', async () => {
    const res = await request(appWithFakes()).post('/api/v1/chat').send({ message: '' });
    expect(res.status).toBe(400);
  });

  it('returns 503 when the AI service is not configured', async () => {
    const app = createApp({
      resolveOrchestrator: () => {
        throw new Error('not configured');
      },
    });
    const res = await request(app).post('/api/v1/chat').send({ message: 'hi' });
    expect(res.status).toBe(503);
  });
});
