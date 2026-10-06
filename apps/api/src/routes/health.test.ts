import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

describe('health endpoints', () => {
  const app = createApp();

  it('GET /api/v1/health returns ok', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('CareVoice AI');
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('GET /api/v1/readiness returns ready', async () => {
    const res = await request(app).get('/api/v1/readiness');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.checks.server).toBe('ok');
  });

  it('unknown route returns a 404 JSON error', async () => {
    const res = await request(app).get('/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Not found');
  });
});
