/**
 * Minimal echo server — returns whatever you send it.
 * Good for testing that your MCP client is wired up correctly.
 *
 * Usage:
 *   npx ts-node examples/echo-server.ts
 */

import { MCPServer } from '../src';
import { StdioServer } from '../src/transport/stdio';

const server = new MCPServer({ name: 'echo-server', version: '0.1.0' });

server.registerTool('echo', ({ message }) => ({
  echo: message,
}));

server.registerResource('echo://hello', () => 'Hello from mcp-connect!');

const transport = new StdioServer(server);
transport.start();
