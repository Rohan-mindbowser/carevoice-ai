import type { McpTool } from './tool.js';

/** In-process catalogue of healthcare tools. The orchestrator and the MCP server share one. */
export class ToolRegistry {
  private readonly tools = new Map<string, McpTool>();

  register(tool: McpTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Duplicate MCP tool registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): McpTool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): McpTool[] {
    return [...this.tools.values()];
  }
}
