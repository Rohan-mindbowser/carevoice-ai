import type { ZodError } from 'zod';
import type { McpTool, ToolContext, ToolError, ToolErrorKind, ToolResult } from './tool.js';
import type { ToolRegistry } from './registry.js';
import { FhirError } from '../fhir/errors.js';
import { authorizeTool } from '../security/authorization.js';
import { auditToolCall } from '../observability/audit.js';

const DEFAULT_TOOL_TIMEOUT_MS = 10_000;

class ToolTimeoutError extends Error {
  constructor(toolName: string) {
    super(`Tool ${toolName} timed out`);
    this.name = 'ToolTimeoutError';
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, toolName: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ToolTimeoutError(toolName)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Collapse a Zod error into a safe, field-name-only summary (no values → no PHI). */
function summarizeZodError(error: ZodError): string {
  const fields = error.issues.map((issue) => issue.path.join('.') || 'input').join(', ');
  return `Invalid input: ${fields}`;
}

/** Map any thrown error to a client-safe ToolError. Never surfaces raw FHIR/stack detail. */
function mapToToolError(error: unknown): ToolError {
  if (error instanceof ToolTimeoutError) {
    return { kind: 'timeout', message: 'The request timed out. Please try again.' };
  }
  if (error instanceof FhirError) {
    const kind: ToolErrorKind =
      error.kind === 'unauthorized' || error.kind === 'forbidden'
        ? 'forbidden'
        : error.kind === 'not_found'
          ? 'not_found'
          : error.kind === 'timeout'
            ? 'timeout'
            : error.kind === 'unavailable'
              ? 'unavailable'
              : 'internal';
    const messages: Record<ToolErrorKind, string> = {
      not_found: 'The requested patient or record was not found.',
      forbidden: 'Not authorized to access this EHR data.',
      timeout: 'The EHR took too long to respond. Please try again.',
      unavailable: 'The EHR is temporarily unavailable. Please try again.',
      internal: 'An unexpected error occurred retrieving EHR data.',
      invalid_input: 'Invalid request.',
      invalid_output: 'The EHR returned unexpected data.',
    };
    return { kind, message: messages[kind] };
  }
  return { kind: 'internal', message: 'An unexpected error occurred.' };
}

/**
 * Runs a single tool through the full safety pipeline (spec §9):
 *   authorize → validate input → execute (with timeout) → validate output → audit.
 * Returns a structured result; never throws for expected failures. LLM-supplied parameters are
 * validated here and never trusted.
 */
export async function executeTool(
  tool: McpTool,
  rawInput: unknown,
  ctx: ToolContext,
): Promise<ToolResult> {
  const start = performance.now();
  const elapsed = (): number => Math.round(performance.now() - start);
  const base = {
    toolName: tool.name,
    requestId: ctx.requestId,
    userId: ctx.auth.userId,
    tenantId: ctx.auth.tenantId,
  };

  // 1. Authorization — gate before input/data is touched.
  const authz = authorizeTool(ctx.auth, tool.requiredScopes);
  if (!authz.allowed) {
    auditToolCall({ ...base, status: 'denied', reason: authz.reason, latencyMs: elapsed() });
    return {
      ok: false,
      error: { kind: 'forbidden', message: 'You are not authorized to perform this action.' },
    };
  }

  // 2. Input validation — never trust LLM-generated parameters.
  const parsedInput = tool.inputSchema.safeParse(rawInput);
  if (!parsedInput.success) {
    auditToolCall({ ...base, status: 'error', errorKind: 'invalid_input', latencyMs: elapsed() });
    return { ok: false, error: { kind: 'invalid_input', message: summarizeZodError(parsedInput.error) } };
  }

  try {
    // 3. Execute with a timeout backstop.
    const result = await withTimeout(
      tool.execute(parsedInput.data, ctx),
      tool.timeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS,
      tool.name,
    );

    // 4. Output validation — malformed data must never reach the LLM/UI.
    const parsedOutput = tool.outputSchema.safeParse(result);
    if (!parsedOutput.success) {
      auditToolCall({ ...base, status: 'error', errorKind: 'invalid_output', latencyMs: elapsed() });
      return { ok: false, error: { kind: 'invalid_output', message: 'The tool produced invalid output.' } };
    }

    auditToolCall({ ...base, status: 'ok', latencyMs: elapsed() });
    return { ok: true, data: parsedOutput.data };
  } catch (error) {
    const toolError = mapToToolError(error);
    auditToolCall({ ...base, status: 'error', errorKind: toolError.kind, latencyMs: elapsed() });
    return { ok: false, error: toolError };
  }
}

/** Look up a tool by name and execute it. Used by the AI orchestrator (in-process, low latency). */
export async function runTool(
  registry: ToolRegistry,
  name: string,
  rawInput: unknown,
  ctx: ToolContext,
): Promise<ToolResult> {
  const tool = registry.get(name);
  if (!tool) {
    return { ok: false, error: { kind: 'invalid_input', message: `Unknown tool: ${name}` } };
  }
  return executeTool(tool, rawInput, ctx);
}
