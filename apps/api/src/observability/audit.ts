import { logger } from './logger.js';

export type ToolCallStatus = 'ok' | 'denied' | 'error';

/**
 * Audit record for a single MCP tool invocation (spec §9/§25). Deliberately contains only SAFE
 * identifiers — never tool arguments, patient ids, or results — so the audit trail itself can
 * never leak PHI (spec §21).
 */
export interface ToolAuditEntry {
  toolName: string;
  requestId: string;
  userId: string;
  tenantId: string;
  status: ToolCallStatus;
  latencyMs: number;
  errorKind?: string;
  reason?: string;
}

export function auditToolCall(entry: ToolAuditEntry): void {
  logger.info({ event: 'tool_call', ...entry }, 'mcp.tool_call');
}
