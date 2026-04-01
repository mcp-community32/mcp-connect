import * as http from 'http';
import type { MCPServer } from '../server';
import type { JSONRPCRequest, JSONRPCResponse } from '../types';

export interface HttpServerOptions {
  /**
   * Port to listen on.
   * @default 3000
   */
  port?: number;

  /**
   * Hostname to bind to.
   * @default '127.0.0.1'
   */
  host?: string;

  /**
   * Allowed CORS origins. Use '*' to allow all.
   * @default ['*']
   */
  allowedOrigins?: string[];

  /**
   * Optional auth middleware created by createAuthMiddleware().
   * If provided, all non-exempt requests must pass auth before being dispatched.
   */
  auth?: AuthMiddlewareFn;
}

/** Shape returned by createAuthMiddleware — kept as a structural type to avoid a circular import. */
type AuthMiddlewareFn = (
  request: JSONRPCRequest,
  headers: Record<string, string | undefined>,
) => { authenticated: boolean; error?: JSONRPCResponse };

/**
 * HTTP/SSE transport for mcp-connect.
 *
 * - POST /       — single JSON-RPC request, returns JSON-RPC response
 * - GET  /sse    — Server-Sent Events stream; send requests as SSE events, receive responses as SSE events
 * - GET  /health — liveness check, returns 200 OK
 *
 * @example
 * const server = new MCPServer({ name: 'my-server', version: '1.0.0' });
 * const transport = new HttpMCPServer(server, { port: 4000 });
 * transport.start();
 */
export class HttpMCPServer {
  private server: MCPServer;
  private options: Required<Omit<HttpServerOptions, 'auth'>> & { auth?: AuthMiddlewareFn };
  private httpServer: http.Server | null = null;

  constructor(server: MCPServer, options: HttpServerOptions = {}) {
    this.server = server;
    this.options = {
      port: options.port ?? 3000,
      host: options.host ?? '127.0.0.1',
      allowedOrigins: options.allowedOrigins ?? ['*'],
      auth: options.auth,
    };
  }

  start(): void {
    this.httpServer = http.createServer((req, res) => {
      this.applyCors(req, res);

      // Preflight
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

      if (req.method === 'GET' && url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', server: this.server.name }));
        return;
      }

      if (req.method === 'GET' && url.pathname === '/sse') {
        this.handleSSE(req, res);
        return;
      }

      if (req.method === 'POST' && (url.pathname === '/' || url.pathname === '/rpc')) {
        this.handlePost(req, res);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    });

    this.httpServer.listen(this.options.port, this.options.host, () => {
      process.stderr.write(
        `[mcp-connect] HTTP transport listening on http://${this.options.host}:${this.options.port}\n`,
      );
    });
  }

  stop(): void {
    this.httpServer?.close();
  }

  // ── Request handlers ──────────────────────────────────────────────────────

  private handlePost(req: http.IncomingMessage, res: http.ServerResponse): void {
    let body = '';

    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      let rpcRequest: JSONRPCRequest;

      try {
        rpcRequest = JSON.parse(body) as JSONRPCRequest;
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0', id: null,
          error: { code: -32700, message: 'Parse error' },
        }));
        return;
      }

      const headers = this.flattenHeaders(req.headers);

      if (this.options.auth) {
        const authResult = this.options.auth(rpcRequest, headers);
        if (!authResult.authenticated) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(authResult.error));
          return;
        }
      }

      const response = await this.dispatch(rpcRequest);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    });
  }

  private handleSSE(req: http.IncomingMessage, res: http.ServerResponse): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const send = (data: unknown): void => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Keep-alive ping every 15 s
    const ping = setInterval(() => res.write(': ping\n\n'), 15_000);

    req.on('data', async (chunk: Buffer) => {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        const trimmed = line.replace(/^data:\s*/, '').trim();
        if (!trimmed) continue;

        let rpcRequest: JSONRPCRequest;
        try {
          rpcRequest = JSON.parse(trimmed) as JSONRPCRequest;
        } catch {
          send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
          continue;
        }

        const headers = this.flattenHeaders(req.headers);
        if (this.options.auth) {
          const authResult = this.options.auth(rpcRequest, headers);
          if (!authResult.authenticated) {
            send(authResult.error);
            continue;
          }
        }

        const response = await this.dispatch(rpcRequest);
        send(response);
      }
    });

    req.on('close', () => clearInterval(ping));
  }

  // ── Dispatch (mirrors stdio transport) ────────────────────────────────────

  private async dispatch(req: JSONRPCRequest): Promise<JSONRPCResponse> {
    const { id, method, params = {} } = req;

    try {
      const result = await this.route(method, params);
      return { jsonrpc: '2.0', id, result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { jsonrpc: '2.0', id, error: { code: -32000, message } };
    }
  }

  private async route(method: string, params: Record<string, unknown>): Promise<unknown> {
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
      return { contents: [{ uri, text: String(await handler(uri)) }] };
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

  // ── Helpers ───────────────────────────────────────────────────────────────

  private applyCors(req: http.IncomingMessage, res: http.ServerResponse): void {
    const origin = req.headers['origin'] ?? '';
    const allowed = this.options.allowedOrigins;

    const allow =
      allowed.includes('*') || allowed.includes(origin) ? origin || '*' : '';

    if (allow) {
      res.setHeader('Access-Control-Allow-Origin', allow);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    }
  }

  private flattenHeaders(
    headers: http.IncomingHttpHeaders,
  ): Record<string, string | undefined> {
    const flat: Record<string, string | undefined> = {};
    for (const [key, val] of Object.entries(headers)) {
      flat[key] = Array.isArray(val) ? val[0] : val;
    }
    return flat;
  }
}
