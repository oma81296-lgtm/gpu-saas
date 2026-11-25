import { NextRequest, NextResponse } from "next/server";
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
 * RFC 8414: OAuth 2.0 Authorization Server Metadata
 * Discovered automatically by Claude, Cursor, ChatGPT, Antigravity, etc.
 */
export async function GET(req: NextRequest) {
  const origin = getRequestOrigin(req);
  return NextResponse.json(
    {
      issuer: origin,
      authorization_endpoint: `${origin}/oauth/authorize`,
      token_endpoint: `${origin}/api/oauth/token`,
      registration_endpoint: `${origin}/api/oauth/register`,
      response_types_supported: ["code"],
      response_modes_supported: ["query"],
      grant_types_supported: ["authorization_code"],
      token_endpoint_auth_methods_supported: ["none"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: ["mcp:tools"],
    },
    { status: 200, headers: CORS }
  );
}
