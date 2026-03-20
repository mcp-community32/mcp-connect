# mcp-connect

TypeScript toolkit for building [Model Context Protocol](https://modelcontextprotocol.io) (MCP) servers.

MCP is an open protocol that lets AI models like Claude interact with external tools, data sources, and services in a standardized way. `mcp-connect` handles the protocol layer so you can focus on writing your tools.

## Install

```bash
npm install mcp-connect
```

Requires Node.js >= 18.

## Quick Start

```typescript
import { MCPServer } from 'mcp-connect';
import { StdioServer } from 'mcp-connect/transport/stdio';

const server = new MCPServer({ name: 'my-server', version: '1.0.0' });

server.registerTool('add', async ({ a, b }) => ({
  result: (a as number) + (b as number),
}));

const transport = new StdioServer(server);
transport.start();
```

Run it:

```bash
node dist/server.js
```

Then send JSON-RPC over stdin:

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"add","arguments":{"a":3,"b":4}}}
```

## API

### `new MCPServer(options)`

| Option | Type | Description |
|--------|------|-------------|
| `name` | `string` | Server name reported during `initialize` |
| `version` | `string` | Server version |

### `server.registerTool(name, handler)`

Register a callable tool. `handler` receives the tool arguments and should return the result.

### `server.registerResource(uri, handler)`

Register a resource URI. `handler` receives the URI and should return the resource content as a string.

### `server.registerPrompt(name, handler)`

Register a prompt template. `handler` receives the prompt arguments and should return the rendered string.

## Transports

| Transport | Import | Use case |
|-----------|--------|----------|
| Stdio | `mcp-connect/transport/stdio` | Local tools, Claude Desktop |
| HTTP/SSE | `mcp-connect/transport/http` | Remote servers, web clients |

## License

MIT
