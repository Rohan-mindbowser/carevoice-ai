/**
 * Manual end-to-end MCP check: connects a real MCP client to the running API over Streamable HTTP,
 * lists tools, and calls get_latest_lab_results (which hits the live FHIR sandbox).
 *   1) pnpm --filter @carevoice/api dev         # start the API on :3000
 *   2) pnpm --filter @carevoice/api mcp:smoke    # in another terminal
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

async function main(): Promise<void> {
  const url = new URL(process.env.MCP_URL ?? 'http://localhost:3000/mcp');
  const client = new Client({ name: 'carevoice-smoke', version: '0.1.0' });
  await client.connect(new StreamableHTTPClientTransport(url));

  const { tools } = await client.listTools();
  console.log(
    'Tools:',
    tools.map((t) => t.name),
  );

  const result = await client.callTool({
    name: 'get_latest_lab_results',
    arguments: { patientId: '12724066', limit: 3 },
  });
  console.log('get_latest_lab_results result:');
  console.dir(result, { depth: 6 });

  await client.close();
}

main().catch((error: unknown) => {
  console.error('MCP smoke failed:', error);
  process.exit(1);
});
