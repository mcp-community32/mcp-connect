/**
 * mcp-connect
 * TypeScript toolkit for building Model Context Protocol (MCP) servers
 */

export { MCPServer } from './server';
export type { MCPServerOptions, ToolHandler, ResourceHandler, PromptHandler } from './types';
export { createAuthMiddleware } from './middleware/auth';
export type { AuthOptions, AuthStrategy, AuthContext } from './middleware/auth';
export { withLogging, createLogger } from './middleware/logger';
export type { LoggerOptions, LogEntry } from './middleware/logger';
export { StdioServer } from './transport/stdio';
export { HttpMCPServer } from './transport/http';
export type { HttpServerOptions } from './transport/http';
export { withCache, createToolCache } from './middleware/cache';
export type { CacheOptions } from './middleware/cache';
export { MCPValidationError, formatZodError, validationErrorResponse, RPC_ERRORS, MCP_ERRORS } from './errors';
export type { ValidationIssue } from './errors';
