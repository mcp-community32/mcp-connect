/**
 * mcp-connect
 * TypeScript toolkit for building Model Context Protocol (MCP) servers
 */

export { MCPServer } from './server';
export type { MCPServerOptions, ToolHandler, ResourceHandler, PromptHandler } from './types';
export { withCache, createToolCache } from './middleware/cache';
export type { CacheOptions } from './middleware/cache';
