// server/routes/mcp.js
import { getDb } from '../db/index.js';
import { mcpAuthMiddleware } from '../middleware/mcp-auth.js';
import { MCP_TOOLS, executeTool } from '../lib/mcp-tools.js';

const SERVER_INFO = {
  name: 'aurion-editor',
  version: '1.0.0',
};

export default async function mcpRoutes(fastify) {
  // MCP Streamable HTTP endpoint
  fastify.post('/mcp', {
    preHandler: mcpAuthMiddleware,
    config: { rawBody: true },
  }, async (request, reply) => {
    const body = request.body;

    // Handle single request or batch
    if (Array.isArray(body)) {
      const results = await Promise.all(body.map(req => handleJsonRpc(req, request)));
      return reply.send(results.filter(r => r !== null));
    }

    const result = await handleJsonRpc(body, request);
    if (result === null) {
      // Notification - no response needed
      return reply.code(204).send();
    }
    return reply.send(result);
  });
}

async function handleJsonRpc(rpcRequest, fastifyRequest) {
  const { jsonrpc, id, method, params } = rpcRequest;

  if (jsonrpc !== '2.0') {
    return { jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid Request' } };
  }

  // Notifications (no id) return null
  const isNotification = id === undefined;

  try {
    let result;

    switch (method) {
      case 'initialize':
        result = {
          protocolVersion: '2025-03-26',
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        };
        break;

      case 'notifications/initialized':
        return null; // Notification, no response

      case 'tools/list':
        result = {
          tools: MCP_TOOLS.map(t => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
        };
        break;

      case 'tools/call': {
        const { name, arguments: args } = params;
        const tool = MCP_TOOLS.find(t => t.name === name);
        if (!tool) {
          return {
            jsonrpc: '2.0',
            id,
            error: { code: -32602, message: `Unknown tool: ${name}` },
          };
        }

        const db = getDb();
        try {
          const toolResult = await executeTool(name, args || {}, db, fastifyRequest.mcpApiKey);
          result = {
            content: [
              { type: 'text', text: JSON.stringify(toolResult, null, 2) },
            ],
          };
        } catch (err) {
          result = {
            isError: true,
            content: [
              { type: 'text', text: err.message },
            ],
          };
        }
        break;
      }

      case 'ping':
        result = {};
        break;

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        };
    }

    if (isNotification) return null;
    return { jsonrpc: '2.0', id, result };
  } catch (err) {
    if (isNotification) return null;
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32603, message: err.message },
    };
  }
}
