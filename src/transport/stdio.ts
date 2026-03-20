import * as readline from 'readline';
import type { MCPServer } from '../server';
import type { JSONRPCRequest, JSONRPCResponse } from '../types';

/**
 * Stdio transport — reads newline-delimited JSON-RPC from stdin,
 * writes responses to stdout. The standard MCP transport for local use.
 */
export class StdioServer {
  private server: MCPServer;
  private rl: readline.Interface | null = null;

  constructor(server: MCPServer) {
    this.server = server;
  }

  start(): void {
    this.rl = readline.createInterface({
      input: process.stdin,
      terminal: false,
    });

    this.rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      this.handleLine(trimmed);
    });

    this.rl.on('close', () => {
      process.exit(0);
    });
  }

  stop(): void {
    this.rl?.close();
  }

  private handleLine(line: string): void {
    let request: JSONRPCRequest;

    try {
      request = JSON.parse(line) as JSONRPCRequest;
    } catch {
      this.sendError(null, -32700, 'Parse error');
      return;
    }

    this.handleRequest(request).then((response) => {
      process.stdout.write(JSON.stringify(response) + '\n');
    });
  }

  private async handleRequest(req: JSONRPCRequest): Promise<JSONRPCResponse> {
    const { id, method, params = {} } = req;

    try {
      const result = await this.dispatch(method, params);
      return { jsonrpc: '2.0', id, result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { jsonrpc: '2.0', id, error: { code: -32000, message } };
    }
  }

  private async dispatch(method: string, params: Record<string, unknown>): Promise<unknown> {
    if (method === 'initialize') {
      return {
        protocolVersion: '0.1.0',
        serverInfo: { name: this.server.name, version: this.server.version },
        capabilities: { tools: {}, resources: {}, prompts: {} },
      };
    }

    if (method === 'tools/list') {
      return { tools: this.server._listTools().map(name => ({ name })) };
    }

    if (method === 'tools/call') {
      const name = params.name as string;
      const handler = this.server._getToolHandler(name);
      if (!handler) throw new Error(`Tool not found: ${name}`);
      return handler(params.arguments as Record<string, unknown> ?? {});
    }

    if (method === 'resources/list') {
      return { resources: this.server._listResources().map(uri => ({ uri })) };
    }

    if (method === 'resources/read') {
      const uri = params.uri as string;
      const handler = this.server._getResourceHandler(uri);
      if (!handler) throw new Error(`Resource not found: ${uri}`);
      const content = await handler(uri);
      return { contents: [{ uri, text: String(content) }] };
    }

    if (method === 'prompts/list') {
      return { prompts: this.server._listPrompts().map(name => ({ name })) };
    }

    if (method === 'prompts/get') {
      const name = params.name as string;
      const handler = this.server._getPromptHandler(name);
      if (!handler) throw new Error(`Prompt not found: ${name}`);
      const text = await handler(params.arguments as Record<string, unknown> ?? {});
      return { messages: [{ role: 'user', content: { type: 'text', text } }] };
    }

    throw new Error(`Method not found: ${method}`);
  }

  private sendError(id: null, code: number, message: string): void {
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n');
  }
}
