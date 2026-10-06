import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import type { RequestHandler } from 'express';
import type { ToolRegistry } from './registry.js';
import type { AuthContext } from '../security/authorization.js';
import { devAuthContext } from '../security/authorization.js';
import { executeTool } from './executor.js';
import { getFhirClient } from '../fhir/create-fhir-client.js';
import { logger } from '../observability/logger.js';

/**
 * Builds a real MCP server exposing CareVoice's healthcare tools. This is the *standardized*
 * surface the spec argues for (§8): any MCP client (another agent, a desktop app) can discover and
 * call these tools. Every call still flows through {@link executeTool}, so the same authorization,
 * validation, timeout, and audit guarantees apply as for in-process use.
 */
function buildMcpServer(registry: ToolRegistry, auth: AuthContext, requestId: string): McpServer {
  const server = new McpServer({ name: 'carevoice-ai', version: '0.1.0' });
  const fhir = getFhirClient();

  for (const tool of registry.list()) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputShape,
        outputSchema: tool.outputShape,
      },
      async (args: unknown) => {
        const result = await executeTool(tool, args, { auth, requestId, fhir });
        if (!result.ok) {
          return {
            isError: true,
            content: [{ type: 'text', text: `${result.error.kind}: ${result.error.message}` }],
          };
        }
        return {
          content: [{ type: 'text', text: JSON.stringify(result.data) }],
          structuredContent: result.data as Record<string, unknown>,
        };
      },
    );
  }

  return server;
}

/**
 * Express handler for the MCP endpoint (Streamable HTTP with sessions). A session is created on the
 * `initialize` request and reused for subsequent calls via the `mcp-session-id` header, which is
 * what MCP clients expect. `enableJsonResponse` keeps responses as plain JSON.
 *
 * Note: sessions are held in process memory, so multi-instance deployments need sticky sessions or
 * a shared session store (spec §36). Auth is a dev identity until Phase 12 derives it from a token.
 */
export function createMcpHttpHandler(registry: ToolRegistry): RequestHandler {
  const transports = new Map<string, StreamableHTTPServerTransport>();

  return (req, res, next) => {
    void (async () => {
      try {
        const sessionId = req.header('mcp-session-id');
        const existing = sessionId ? transports.get(sessionId) : undefined;

        if (existing) {
          await existing.handleRequest(req, res, req.body);
          return;
        }

        if (req.method !== 'POST' || !isInitializeRequest(req.body)) {
          res.status(400).json({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'No valid session. Send an initialize request first.' },
            id: null,
          });
          return;
        }

        const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          enableJsonResponse: true,
          onsessioninitialized: (id) => {
            transports.set(id, transport);
          },
        });
        transport.onclose = () => {
          const id = transport.sessionId;
          if (id) transports.delete(id);
        };

        const server = buildMcpServer(registry, devAuthContext(), req.requestId);
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        logger.error(
          { requestId: req.requestId, err: error instanceof Error ? error.message : 'unknown' },
          'mcp request failed',
        );
        next(error);
      }
    })();
  };
}
