import type { ZodError } from 'zod';
import type { JSONRPCResponse } from './types';

/** Standard JSON-RPC 2.0 error codes */
export const RPC_ERRORS = {
  PARSE_ERROR:      -32700,
  INVALID_REQUEST:  -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS:   -32602,
  INTERNAL_ERROR:   -32603,
} as const;

/** MCP-specific error codes (server-defined range: -32000 to -32099) */
export const MCP_ERRORS = {
  SERVER_ERROR:     -32000,
  UNAUTHORIZED:     -32001,
  TOOL_NOT_FOUND:   -32002,
  RESOURCE_NOT_FOUND: -32003,
  PROMPT_NOT_FOUND: -32004,
  VALIDATION_ERROR: -32005,
} as const;

/**
 * Thrown when incoming tool/prompt params fail schema validation.
 * Carry the formatted human-readable issues so the transport can
 * surface them directly in the JSON-RPC error response.
 */
export class MCPValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    const summary = issues.map(i => `'${i.path}' ${i.message}`).join('; ');
    super(summary);
    this.name = 'MCPValidationError';
    this.issues = issues;
  }
}

export interface ValidationIssue {
  /** Dot-separated param path, e.g. "options.limit" */
  path: string;
  /** Human-readable message, e.g. "must be a number" */
  message: string;
}

/**
 * Converts a Zod error into a flat list of human-readable issues.
 * Strips Zod internals so the client only sees clean param paths and messages.
 *
 * @example
 * const result = MySchema.safeParse(params);
 * if (!result.success) throw new MCPValidationError(formatZodError(result.error));
 */
export function formatZodError(error: ZodError): ValidationIssue[] {
  return error.issues.map(issue => ({
    path: issue.path.length > 0 ? issue.path.join('.') : '(root)',
    message: zodMessage(issue.code, issue),
  }));
}

/** Maps Zod issue codes to readable messages without leaking Zod internals. */
function zodMessage(code: string, issue: ZodError['issues'][number]): string {
  switch (code) {
    case 'invalid_type':
      return `must be a ${(issue as { expected: string }).expected}`;
    case 'too_small': {
      const i = issue as { minimum: number; type: string; inclusive: boolean };
      const op = i.inclusive ? '>=' : '>';
      return i.type === 'string'
        ? `must be at least ${i.minimum} character${i.minimum === 1 ? '' : 's'}`
        : `must be ${op} ${i.minimum}`;
    }
    case 'too_big': {
      const i = issue as { maximum: number; type: string; inclusive: boolean };
      const op = i.inclusive ? '<=' : '<';
      return i.type === 'string'
        ? `must be at most ${i.maximum} character${i.maximum === 1 ? '' : 's'}`
        : `must be ${op} ${i.maximum}`;
    }
    case 'invalid_enum_value': {
      const i = issue as { options: unknown[] };
      return `must be one of: ${i.options.map(o => JSON.stringify(o)).join(', ')}`;
    }
    case 'invalid_string':
      return `must be a valid ${(issue as { validation: string }).validation}`;
    case 'unrecognized_keys': {
      const i = issue as { keys: string[] };
      return `unexpected key${i.keys.length === 1 ? '' : 's'}: ${i.keys.map(k => `'${k}'`).join(', ')}`;
    }
    default:
      return issue.message;
  }
}

/**
 * Builds a JSON-RPC error response from an MCPValidationError.
 * Includes the structured issues in the `data` field for clients that want them.
 */
export function validationErrorResponse(
  id: string | number | null,
  err: MCPValidationError,
): JSONRPCResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code: MCP_ERRORS.VALIDATION_ERROR,
      message: err.message,
      data: { issues: err.issues },
    },
  };
}
