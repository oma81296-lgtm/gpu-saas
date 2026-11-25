import { NextRequest, NextResponse } from "next/server";
import { BRAND } from "@/lib/brand";
import { getRequestOrigin } from "@/lib/mcp/oauth";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * RFC 9728: OAuth 2.0 Protected Resource Metadata
 * Tells MCP clients where to authorize to access `/api/mcp`.
 */
export async function GET(req: NextRequest) {
  const origin = getRequestOrigin(req);
  return NextResponse.json(
    {
      resource: `${origin}/api/mcp`,
      authorization_servers: [origin],
      bearer_methods_supported: ["header"],
      scopes_supported: ["mcp:tools"],
      resource_name: `${BRAND.name} MCP Server`,
      resource_documentation: `${origin}/api-keys`,
    },
    { status: 200, headers: CORS }
  );
}
