import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { NextRequest, NextResponse } from "next/server";
import {
  AuthError,
  authenticateApiKeyToken,
  requireAuth,
} from "@/lib/appwrite/server";
import { isApiKeyToken } from "@/lib/api-keys";
import { BRAND } from "@/lib/brand";
import { getRequestOrigin } from "@/lib/mcp/oauth";
import { createVoltGpuMcpServer } from "@/lib/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-API-Key, Mcp-Session-Id, Mcp-Protocol-Version",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, WWW-Authenticate",
};

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    headers.set(k, v);
  }
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

async function authenticateMcpRequest(req: NextRequest) {
  const xApiKey = req.headers.get("x-api-key")?.trim();
  if (xApiKey && isApiKeyToken(xApiKey)) {
    return authenticateApiKeyToken(xApiKey);
  }
  return requireAuth(req);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  // Stateless Streamable HTTP MCP endpoint metadata & health check
  return NextResponse.json(
    {
      name: `${BRAND.name} Remote MCP Server`,
      protocol: "Model Context Protocol (Streamable HTTP)",
      transport: "stateless",
      auth: "Authorization: Bearer vgpu_live_... (or X-API-Key header)",
      docs: `${BRAND.appUrl}/api-keys`,
      tools: [
        "get_balance",
        "list_gpus",
        "list_templates",
        "list_pods",
        "get_pod",
        "deploy_pod",
        "stop_pod",
      ],
    },
    { status: 200, headers: CORS_HEADERS }
  );
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await authenticateMcpRequest(req);
    const server = createVoltGpuMcpServer(ctx);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    await server.connect(transport);
    const response = await transport.handleRequest(req);
    return withCors(response);
  } catch (err) {
    if (err instanceof AuthError) {
      const origin = getRequestOrigin(req);
      const headers: Record<string, string> = {
        ...CORS_HEADERS,
      };
      if (err.status === 401) {
        headers["WWW-Authenticate"] =
          `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource", scope="mcp:tools"`;
      }
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          error: {
            code: -32001,
            message: err.message,
          },
          id: null,
        },
        { status: err.status, headers }
      );
    }

    console.error("[mcp:post]", err);
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message:
            err instanceof Error ? err.message : "Internal MCP server error",
        },
        id: null,
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function DELETE() {
  // Stateless server has no persistent session to tear down
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
