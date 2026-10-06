import type { ZodType, ZodRawShape } from 'zod';
import type { FHIRClient } from '../fhir/fhir-client.js';
import type { AuthContext } from '../security/authorization.js';

/** Everything a tool needs to run, injected by the executor (never global state). */
export interface ToolContext {
  auth: AuthContext;
  requestId: string;
  fhir: FHIRClient;
}

export type ToolErrorKind =
  | 'forbidden'
  | 'invalid_input'
  | 'invalid_output'
  | 'not_found'
  | 'timeout'
  | 'unavailable'
  | 'internal';

export interface ToolError {
  kind: ToolErrorKind;
  /** Client-safe message — no PHI, no raw FHIR, no stack detail. */
  message: string;
}

export type ToolResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: ToolError };

/**
 * A healthcare MCP tool. The type is intentionally erased (`unknown` in/out) so a heterogeneous
 * set of tools lives in one registry; type safety is recovered at each tool's definition site via
 * its Zod schemas, and the executor validates input and output against them at runtime.
 *
 * - `inputSchema` / `outputSchema` drive runtime validation (spec §9).
 * - `inputShape` / `outputShape` are the raw Zod shapes used to generate JSON Schema for the LLM
 *   and to register the tool with the MCP SDK server.
 * - `requiredScopes` are checked at the tool boundary before execution.
 */
export interface McpTool {
  name: string;
  title: string;
  description: string;
  inputSchema: ZodType;
  inputShape: ZodRawShape;
  outputSchema: ZodType;
  outputShape: ZodRawShape;
  requiredScopes: string[];
  timeoutMs?: number;
  execute(input: unknown, ctx: ToolContext): Promise<unknown>;
}
