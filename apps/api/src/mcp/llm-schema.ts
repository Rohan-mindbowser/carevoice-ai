import { z } from 'zod';
import type { McpTool } from './tool.js';

/** Function-declaration shape most LLM function-calling APIs accept (name + description + params). */
export interface LlmFunctionDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * Convert a tool's input shape into JSON Schema for LLM function calling (spec §13). Uses Zod 4's
 * built-in `z.toJSONSchema` — no extra dependency. This is consumed by the Gemini layer in Phase 6.
 */
export function toFunctionDeclaration(tool: McpTool): LlmFunctionDeclaration {
  return {
    name: tool.name,
    description: tool.description,
    parameters: z.toJSONSchema(z.object(tool.inputShape)) as Record<string, unknown>,
  };
}
