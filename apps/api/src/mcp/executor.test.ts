import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { executeTool, runTool } from './executor.js';
import { createToolRegistry } from './tools/index.js';
import type { McpTool } from './tool.js';
import { FhirError } from '../fhir/errors.js';
import { FakeFhirClient, clinicianAuth, toolContext } from './test-support.js';

const EchoInput = z.object({ value: z.string().min(1) });
const EchoOutput = z.object({ value: z.string() });

function echoTool(overrides: Partial<McpTool> = {}): McpTool {
  return {
    name: 'echo',
    title: 'Echo',
    description: 'Echo a value',
    inputSchema: EchoInput,
    inputShape: EchoInput.shape,
    outputSchema: EchoOutput,
    outputShape: EchoOutput.shape,
    requiredScopes: ['patient/Patient.read'],
    execute: async (raw) => EchoInput.parse(raw),
    ...overrides,
  };
}

const fhir = new FakeFhirClient();

describe('executeTool pipeline', () => {
  it('runs a valid call and returns validated data', async () => {
    const result = await executeTool(echoTool(), { value: 'hi' }, toolContext(fhir, clinicianAuth()));
    expect(result).toEqual({ ok: true, data: { value: 'hi' } });
  });

  it('denies when the caller lacks the required scope', async () => {
    const auth = clinicianAuth({ scopes: ['patient/Observation.read'] });
    const result = await executeTool(echoTool(), { value: 'hi' }, toolContext(fhir, auth));
    expect(result).toEqual({ ok: false, error: { kind: 'forbidden', message: expect.any(String) } });
  });

  it('denies when the caller has no clinical role', async () => {
    const auth = clinicianAuth({ roles: ['billing'] });
    const result = await executeTool(echoTool(), { value: 'hi' }, toolContext(fhir, auth));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('forbidden');
  });

  it('rejects invalid LLM-supplied input without calling the handler', async () => {
    let called = false;
    const tool = echoTool({
      execute: async (raw) => {
        called = true;
        return EchoInput.parse(raw);
      },
    });
    const result = await executeTool(tool, { value: 123 }, toolContext(fhir, clinicianAuth()));
    expect(called).toBe(false);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('invalid_input');
  });

  it('fails closed when the handler returns schema-invalid output', async () => {
    const tool = echoTool({ execute: async () => ({ wrong: true }) });
    const result = await executeTool(tool, { value: 'hi' }, toolContext(fhir, clinicianAuth()));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('invalid_output');
  });

  it('maps a FhirError not_found to a safe tool error', async () => {
    const tool = echoTool({
      execute: async () => {
        throw new FhirError('not_found', 'should not leak');
      },
    });
    const result = await executeTool(tool, { value: 'hi' }, toolContext(fhir, clinicianAuth()));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('not_found');
      expect(result.error.message).not.toContain('should not leak');
    }
  });

  it('times out a slow handler', async () => {
    const tool = echoTool({
      timeoutMs: 20,
      execute: () => new Promise(() => {}), // never resolves
    });
    const result = await executeTool(tool, { value: 'hi' }, toolContext(fhir, clinicianAuth()));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('timeout');
  });
});

describe('runTool via registry', () => {
  it('returns an error for an unknown tool', async () => {
    const result = await runTool(createToolRegistry(), 'nope', {}, toolContext(fhir, clinicianAuth()));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('invalid_input');
  });
});
