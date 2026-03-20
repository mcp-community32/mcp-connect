import type { MCPServerOptions, ToolHandler, ResourceHandler, PromptHandler } from './types';

/**
 * Core MCP server class.
 * Wire up a transport then call start().
 */
export class MCPServer {
  readonly name: string;
  readonly version: string;

  private tools: Map<string, ToolHandler> = new Map();
  private resources: Map<string, ResourceHandler> = new Map();
  private prompts: Map<string, PromptHandler> = new Map();

  constructor(options: MCPServerOptions) {
    this.name = options.name;
    this.version = options.version;
  }

  /**
   * Register a callable tool.
   * @param name - Unique tool name
   * @param handler - Called with validated params, must return the tool result
   */
  registerTool(name: string, handler: ToolHandler): this {
    this.tools.set(name, handler);
    return this;
  }

  /**
   * Register a resource URI handler.
   * @param uri - URI pattern (exact match for now)
   * @param handler - Called with the URI, returns the resource content
   */
  registerResource(uri: string, handler: ResourceHandler): this {
    this.resources.set(uri, handler);
    return this;
  }

  /**
   * Register a prompt template.
   * @param name - Prompt name
   * @param handler - Called with prompt args, returns the rendered prompt string
   */
  registerPrompt(name: string, handler: PromptHandler): this {
    this.prompts.set(name, handler);
    return this;
  }

  /** Start the server (transport-specific — overridden by transport wrappers) */
  start(): void {
    throw new Error('No transport attached. Use StdioServer or HttpServer instead.');
  }

  /** Stop the server */
  stop(): void {
    // no-op at base level
  }

  // Internal helpers for transports

  /** @internal */
  _getToolHandler(name: string): ToolHandler | undefined {
    return this.tools.get(name);
  }

  /** @internal */
  _getResourceHandler(uri: string): ResourceHandler | undefined {
    return this.resources.get(uri);
  }

  /** @internal */
  _getPromptHandler(name: string): PromptHandler | undefined {
    return this.prompts.get(name);
  }

  /** @internal */
  _listTools(): string[] {
    return Array.from(this.tools.keys());
  }

  /** @internal */
  _listResources(): string[] {
    return Array.from(this.resources.keys());
  }

  /** @internal */
  _listPrompts(): string[] {
    return Array.from(this.prompts.keys());
  }
}
