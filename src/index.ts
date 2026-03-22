/**
 * mcp-connect
 * TypeScript toolkit for building Model Context Protocol (MCP) servers
 */

export { MCPServer } from './server';
export type { MCPServerOptions, ToolHandler, ResourceHandler, PromptHandler } from './types';
export { createAuthMiddleware } from './middleware/auth';
export type { AuthOptions, AuthStrategy, AuthContext } from './middleware/auth';
