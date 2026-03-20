/** JSON-RPC 2.0 message types used by MCP */

export interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface MCPServerOptions {
  name: string;
  version: string;
}

export type ToolHandler = (params: Record<string, unknown>) => Promise<unknown> | unknown;
export type ResourceHandler = (uri: string) => Promise<unknown> | unknown;
export type PromptHandler = (args: Record<string, unknown>) => Promise<string> | string;
