import type { JSONRPCRequest, JSONRPCResponse } from '../types';

export type AuthStrategy = 'bearer' | 'apikey';

export interface AuthOptions {
  /**
   * Authentication strategy to use.
   * - 'bearer': expects `Authorization: Bearer <token>` header
   * - 'apikey': expects `X-API-Key: <key>` header
   */
  strategy: AuthStrategy;

  /**
   * One or more valid tokens/keys. At least one must match.
   */
  tokens: string[];

  /**
   * Optional list of MCP methods to exempt from auth checks (e.g. 'initialize').
   * Defaults to ['initialize'].
   */
  exempt?: string[];
}

export interface AuthContext {
  authenticated: boolean;
  token?: string;
}

const DEFAULT_EXEMPT = ['initialize'];

/**
 * Validates a bearer token from an Authorization header value.
 * Returns the token string if valid, undefined otherwise.
 */
function extractBearer(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return undefined;
  return parts[1];
}

/**
 * Creates an auth middleware function for MCP requests.
 *
 * @example
 * const auth = createAuthMiddleware({
 *   strategy: 'bearer',
 *   tokens: [process.env.MCP_TOKEN!],
 * });
 *
 * // In your HTTP transport:
 * const result = auth(request, headers);
 * if (!result.authenticated) {
 *   // return 401
 * }
 */
export function createAuthMiddleware(options: AuthOptions) {
  const exempt = options.exempt ?? DEFAULT_EXEMPT;
  const validTokens = new Set(options.tokens);

  return function authMiddleware(
    request: JSONRPCRequest,
    headers: Record<string, string | undefined>,
  ): { authenticated: boolean; error?: JSONRPCResponse } {
    // Skip auth for exempted methods
    if (exempt.includes(request.method)) {
      return { authenticated: true };
    }

    let candidate: string | undefined;

    if (options.strategy === 'bearer') {
      candidate = extractBearer(headers['authorization']);
    } else if (options.strategy === 'apikey') {
      candidate = headers['x-api-key'];
    }

    if (!candidate || !validTokens.has(candidate)) {
      return {
        authenticated: false,
        error: {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32001,
            message: 'Unauthorized',
          },
        },
      };
    }

    return { authenticated: true };
  };
}
